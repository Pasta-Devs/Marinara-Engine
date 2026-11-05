/**
 * A condition held only while an ally is seen near (Capability API 1.682).
 *
 *   - `heldOnlyIn.allySeenWithin`: a bearded devil's Steadfast, kept on, makes it immune to being
 *     frightened while it sees an ally within 30 feet; with the ally too far, behind a wall, or down,
 *     it is not. Off a board, any ally standing will do.
 *   - Import refusals, and the install gate.
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
  rulesetImmuneToCondition,
  supportedCapabilityApi,
  type RulesetCombatCell,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-steadfast-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 682);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (held: Record<string, unknown> = { allySeenWithin: 30 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "steadfast", label: "Steadfast" });
    doc.combat.conditions.push({ condition: "steadfast", conditionImmunities: ["frightened"], heldOnlyIn: held });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const block = (keepsOn: string[] = []) =>
    ({
      health: 52,
      defense: 13,
      initiativeModifier: 0,
      speed: 30,
      keepsOn,
      actions: [],
    }) as unknown as RulesetStatBlock;
  const grid = (wall = false): TacticalGrid => {
    const tiles = Array.from({ length: 15 }, () => Array(20).fill("plains"));
    if (wall) for (let y = 0; y < 15; y++) tiles[y]![7] = "wall";
    return { width: 20, height: 15, tiles } as TacticalGrid;
  };
  /** Whether the devil may be frightened, with its ally where it stands. */
  const immune = (ally: RulesetCombatCell | null, options: { wall?: boolean; down?: boolean } = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "devil", name: "Bearded Devil", side: "enemy", block: block(["steadfast"]) },
        { id: "imp", name: "Imp", side: "enemy", block: block() },
        { id: "hero", name: "Hero", side: "party", block: block() },
      ],
      ...(ally
        ? {
            board: {
              grid: grid(options.wall),
              placements: { devil: { x: 5, y: 5 }, imp: ally, hero: { x: 19, y: 14 } },
            },
          }
        : {}),
    });
    if (options.down) rulesetCombatant(state, "imp")!.defeated = true;
    return rulesetImmuneToCondition(rulesetCombatant(state, "devil")!, "frightened", definition, state);
  };

  assert.equal(immune({ x: 9, y: 5 }), true, "an ally seen 20 feet off");
  assert.equal(immune({ x: 12, y: 5 }), false, "35 feet is too far");
  assert.equal(immune({ x: 9, y: 5 }, { wall: true }), false, "behind a wall");
  assert.equal(immune({ x: 9, y: 5 }, { down: true }), false, "an ally down is no ally");
  assert.equal(immune(null), true, "off a board, an ally standing");

  // ── Refusals ──
  refused(fiveE({}), /"heldOnlyIn" names a light, an ally seen within a distance, ground, or more than one/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition held only while its holder sees an ally near (heldOnlyIn.allySeenWithin) requires schemaVersion 2 and capabilityApi 1.682 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(681) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(682) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(681) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Steadfast: held only while an ally is seen near; gated at 1.682.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
