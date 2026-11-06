/**
 * A sense that sees through walls (Capability API 1.719): 5e's Ring of X-ray Vision.
 *
 *   - Within its range a wall between keeps nothing from it; past its range the wall does.
 *   - Without it, the wall hides as before.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCanSee,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-xray-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 719);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = () => {
    const doc = JSON.parse(fiveEText);
    doc.combat.senses = [{ id: "xray", label: "X-ray Vision", throughWalls: true }];
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const brute = (id: string, side: "party" | "enemy", xray?: number) => ({
    id,
    name: id,
    side,
    block: {
      health: 100,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      ...(xray ? { senses: { xray } } : {}),
      actions: [{ name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 6, flat: 3 } }],
    } as never,
  });
  // A wall at x 3 between the viewers at 0 and whoever stands past it.
  const tiles = [Array.from({ length: 20 }, (_, x) => (x === 3 ? "wall" : "plains"))];
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    board: {
      grid: { width: 20, height: 1, tiles },
      placements: { seer: { x: 0, y: 0 }, plain: { x: 1, y: 0 }, hidden: { x: 6, y: 0 } },
    } as never,
    combatants: [brute("seer", "party", 30), brute("plain", "party"), brute("hidden", "enemy")],
  });
  const seer = rulesetCombatant(state, "seer")!;
  const plain = rulesetCombatant(state, "plain")!;
  const hidden = rulesetCombatant(state, "hidden")!;
  assert.equal(rulesetCanSee(definition, state, seer, hidden), true, "30 feet away through the wall: seen");
  assert.equal(rulesetCanSee(definition, state, plain, hidden), false, "without the sense the wall hides them");
  hidden.x = 7;
  assert.equal(rulesetCanSee(definition, state, seer, hidden), false, "35 feet away: past its range");
  hidden.x = 2;
  assert.equal(rulesetCanSee(definition, state, plain, hidden), true, "no wall between: seen by anyone");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a sense that sees through walls (combat.senses[].throughWalls) requires schemaVersion 2 and capabilityApi 1.719 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(718) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(719) as never, document()), gate);
  }

  console.log(
    "X-ray vision: sees through a wall within 30 feet, not past it; without it the wall hides; gated at 1.719.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
