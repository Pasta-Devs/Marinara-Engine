/**
 * A climb kept off some ground (Capability API 1.671).
 *
 *   - A condition's climb with `climbNotOn` (Slippers of Spider Climbing) takes no step into a tile
 *     it names, nor into ground a lasting area makes slippery (`terrain.slippery`, Grease).
 *   - A climb that says nothing of it still climbs anywhere, and so does one held beside it.
 *   - On a board whose place it names, the condition gives no climb at all.
 *   - Import refusal and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetReachableCells,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetSyncSpeeds } from "../../packages/shared/src/features/ruleset-combat/encounter.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-climb-not-on-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 671);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const slippers = { slippery: true, terrain: ["forest"] };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "spider", label: "Slippers of Spider Climbing" },
      { id: "wallclimb", label: "Spider Climb" },
    );
    doc.combat.conditions.push(
      { condition: "spider", effects: [], speeds: { climb: "walk" }, climbNotOn: slippers },
      { condition: "wallclimb", effects: [], speeds: { climb: "walk" } },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (): RulesetStatBlock =>
    ({ health: 80, defense: 5, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  // Three ledges two levels up down column 2: plain ground, slick ground and forest.
  const grid = (): TacticalGrid => {
    const tiles = Array.from({ length: 5 }, () => Array(6).fill("plains"));
    tiles[4]![2] = "forest";
    const elevation = Array.from({ length: 5 }, () => Array(6).fill(0));
    elevation[0]![2] = elevation[2]![2] = elevation[4]![2] = 2;
    return { width: 6, height: 5, tiles, elevation };
  };
  const fight = (conditions: string[], environment?: string): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: { grid: grid(), placements: { hero: { x: 0, y: 2 }, foe: { x: 5, y: 4 } } },
    });
    if (environment) state.board!.environment = environment;
    // Grease on the middle ledge, the foe's.
    const foe = rulesetCombatant(state, "foe")!;
    foe.actions.push({ id: "grease", label: "Grease", budget: "action", zone: { slippery: true } } as never);
    foe.zones = [
      {
        actionId: "grease",
        label: "Grease",
        rounds: 10,
        anchor: "point",
        triggers: [],
        at: { x: 2, y: 2 },
        cells: [{ x: 2, y: 2 }],
      },
    ];
    const hero = rulesetCombatant(state, "hero")!;
    for (const condition of conditions) hero.tracked.push({ condition, rounds: null } as never);
    rulesetSyncSpeeds(definition, state);
    state.order = ["hero", "foe"];
    state.turn = 0;
    return state;
  };
  const ledges = (state: RulesetEncounterState) => {
    const reach = new Set(rulesetReachableCells(definition, state, "hero").map((cell) => `${cell.x},${cell.y}`));
    return ["2,0", "2,2", "2,4"].filter((cell) => reach.has(cell));
  };

  // ── Nobody climbs without a climb ──
  assert.deepEqual(ledges(fight([])), []);
  // ── A climb that says nothing of it climbs anywhere ──
  assert.deepEqual(ledges(fight(["wallclimb"])), ["2,0", "2,2", "2,4"]);
  // ── The slippers: not into the grease, nor onto the forest ──
  {
    const state = fight(["spider"]);
    assert.deepEqual(rulesetCombatant(state, "hero")!.climbNotOn, { terrain: ["forest"], slippery: true });
    assert.deepEqual(ledges(state), ["2,0"]);
  }
  // ── Beside a free climb, nothing is kept off ──
  {
    const state = fight(["spider", "wallclimb"]);
    assert.equal(rulesetCombatant(state, "hero")!.climbNotOn, undefined);
    assert.deepEqual(ledges(state), ["2,0", "2,2", "2,4"]);
  }
  // ── On a board whose place it names, no climb at all ──
  {
    const state = fight(["spider"], "forest");
    assert.equal(rulesetCombatant(state, "hero")!.speeds?.climb, undefined);
    assert.deepEqual(ledges(state), []);
  }

  // ── Import: Grease's slick ground, and a refusal ──
  {
    parsed(
      fiveE((doc) => {
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [
            {
              id: "grease",
              label: "Grease",
              rows: [{ list: "spells", values: { name: "Grease", level: 1, prepared: true } }],
              mechanics: {
                kind: "utility",
                area: { shape: "burst", size: 5 },
                range: 60,
                zone: { rounds: 10, triggers: [], terrain: { difficult: true, slippery: true } },
              },
            },
          ],
        });
      }),
    );
    const result = parseRulesetDefinition(
      fiveE((doc) => {
        doc.combat.conditions.find((one: { condition: string }) => one.condition === "spider").climbNotOn = {};
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Say where: "terrain", "slippery" or both/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a climb kept off some ground or slippery ground (climbNotOn or terrain.slippery) requires schemaVersion 2 and capabilityApi 1.671 or newer";
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
    const plain = fiveE((doc) => {
      delete doc.combat.conditions.find((one: { condition: string }) => one.condition === "spider").climbNotOn;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(670) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(671) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(670) as never, plain), gate);
  }

  console.log(
    "Climb kept off: the slippers climb neither into grease nor onto the forest, a free climb beside them climbs anywhere, a board of that place gives none; gated at 1.671.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
