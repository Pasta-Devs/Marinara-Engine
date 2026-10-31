/**
 * Walking on water (Capability API 1.529).
 *
 *   - Water Walk: its holder walks onto water at a plain step, may stop there, and is never under
 *     it; without it, water is not walked at all. No ledge is climbed, as `runsAcross` would.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  RULESET_MOVE_OPTION,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetUnderwater } from "../../packages/shared/src/features/ruleset-combat/grid.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-water-walking-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 529);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "water_walking", label: "Water Walking" });
    doc.combat.conditions.push({ condition: "water_walking", effects: [], walksOnLiquid: true });
    doc.combat.underwater ??= { terrain: ["water"], resist: ["fire"] };
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const block = {
    health: 80,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  // Water down columns 5 to 7, and a ledge two levels up at (2, 0).
  const grid = (): TacticalGrid => {
    const tiles = Array.from({ length: 9 }, () => Array(12).fill("plains"));
    for (const row of tiles) row[5] = row[6] = row[7] = "water";
    const elevation = Array.from({ length: 9 }, () => Array(12).fill(0));
    elevation[0]![2] = 2;
    return { width: 12, height: 9, tiles, elevation };
  };
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (walking: boolean, at = { x: 4, y: 4 }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 8 },
            fields: { level: 5, ac: 14, speed: 30, hp_max: 40 },
          }),
          live: walking ? { conditions: ["water_walking"] } : {},
        },
        { id: "foe", name: "Foe", side: "enemy", block },
      ],
      board: { grid: grid(), placements: { hero: at, foe: { x: 10, y: 8 } } },
    });
    state.order = ["hero", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const cells = (state: RulesetEncounterState) =>
    new Map(
      (rulesetCombatOptions(definition, state, "hero").find((one) => one.id === RULESET_MOVE_OPTION)?.cells ?? []).map(
        (cell) => [`${cell.x},${cell.y}`, cell.cost],
      ),
    );

  {
    const dry = fight(false);
    assert.equal(cells(dry).has("5,4"), false, "nobody walks onto water");
    const walker = fight(true);
    assert.equal(who(walker, "hero").walksOnLiquid, true);
    const reach = cells(walker);
    assert.equal(reach.get("5,4"), 1, "onto the water for a plain step");
    assert.equal(reach.get("6,4"), 2, "and stopped on");
    const onto = applyRulesetCombatChoice(
      definition,
      walker,
      { actorId: "hero", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 6, y: 4 } } as RulesetCombatChoice,
      roll,
    );
    assert.equal(of(onto.events, "refused").length, 0, JSON.stringify(of(onto.events, "refused")));
    const hero = who(onto.state, "hero");
    assert.deepEqual({ x: hero.x, y: hero.y }, { x: 6, y: 4 }, "standing on the water");
    assert.equal(rulesetUnderwater(definition, onto.state, hero), false, "on it, not under it");
    // No ledge climbed.
    assert.equal(cells(fight(true, { x: 2, y: 1 })).has("2,0"), false);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions let their holder walk on water (walksOnLiquid) requires schemaVersion 2 and capabilityApi 1.529 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(528) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(529) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(528) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Water walking: Water Walk walks onto water for a plain step, stops there, is not under it, and climbs no ledge; gated at 1.529.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
