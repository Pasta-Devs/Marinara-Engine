/**
 * Conditions held off on some terrains (Capability API 1.478).
 *
 *   - The aboleth's curse: no healing comes back on dry ground, and it does in water, or anywhere
 *     on a board whose environment is water; the curse is held off, not ended.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-off-terrain-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 478);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const cure = {
    id: "cure",
    label: "Cure",
    rows: [{ list: "spells", values: { name: "Cure", level: 1, prepared: true } }],
    mechanics: { kind: "heal", targets: "ally", range: 30, amount: { flat: 5 } },
  } as unknown as RulesetCatalogEntry;
  const entries = [cure];
  const fiveE = (curse: Record<string, unknown> = { whileOffTerrain: ["water"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "aboleth_curse", label: "Aboleth's curse" });
    doc.combat.conditions.push({ condition: "aboleth_curse", effects: ["cannot-heal"], ...curse });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  const fight = (friendTile = "plains", environment?: string) => {
    const tiles = Array.from({ length: 6 }, () => Array(6).fill("plains"));
    tiles[1]![2] = friendTile;
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
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 40 },
          }),
          live: { pools: { hp: { value: 20 } } },
        },
      ],
      board: {
        grid: { width: 6, height: 6, tiles },
        ...(environment ? { environment } : {}),
        placements: { cleric: { x: 1, y: 1 }, friend: { x: 2, y: 1 } },
      },
    });
    state.order = ["cleric", "friend"];
    state.turn = 0;
    rulesetCombatant(state, "friend")!.tracked.push({ condition: "aboleth_curse", rounds: null });
    return state;
  };
  const heal = (state: RulesetEncounterState) => {
    rulesetCombatant(state, "cleric")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "cleric").find((one) => one.label === "Cure");
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "cleric", optionId: option.id, targetIds: ["friend"] },
      () => 1,
    );
    Object.assign(state, step.state);
    const found = step.events.find((one): one is Extract<RulesetCombatEvent, { type: "heal" }> => one.type === "heal");
    assert.ok(found, "no heal");
    return found;
  };
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, "friend")!).value;
  const cursed = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "friend")!.tracked.some((one) => one.condition === "aboleth_curse");

  // ── On dry ground, nothing comes back ──
  {
    const state = fight();
    assert.equal(heal(state).blocked, true);
    assert.equal(hp(state), 20);
  }
  // ── In water, or on a board under water, it does; the curse stays on ──
  for (const state of [fight("water"), fight("plains", "water")]) {
    assert.equal(heal(state).blocked, undefined);
    assert.equal(hp(state), 25);
    assert.equal(cursed(state), true, "held off, not ended");
  }

  // ── Refusals ──
  refused(fiveE({ whileOffTerrain: [] }), /whileOffTerrain/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions are held off on some terrains (whileOffTerrain) requires schemaVersion 2 and capabilityApi 1.478 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(477) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(478) as never, fiveE()), gate);
  }

  console.log("Off terrain: an aboleth's curse keeps healing off on dry ground, not in water; gated at 1.478.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
