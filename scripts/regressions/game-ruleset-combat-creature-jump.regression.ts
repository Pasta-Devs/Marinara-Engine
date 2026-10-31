/**
 * A creature's own jump (Capability API 1.716): 5e's bulette, Standing Leap, a 30-foot long jump and
 * a 15-foot high one, with or without a running start.
 *
 *   - `creature.jump`: the distances in place of what the ruleset reads off its abilities, copied
 *     off its catalog entry into its block.
 *   - `withoutRunUp`: the whole distance standing; without it, the ruleset's `standing` halves it.
 *   - A condition's `jumps` still multiplies it.
 *   - Import refusals and the install gate.
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
  rulesetJumpReach,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-jump-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 716);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const leap = { long: 30, high: 15, withoutRunUp: true };
  const fiveE = (jump: unknown = leap): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.jumping = {
      long: { ability: "str", of: "score" },
      high: { ability: "str", of: "modifier", plus: 3 },
      runUp: 10,
      standing: "half",
    };
    doc.sheet.live.conditions.push({ id: "jump", label: "Jump" });
    doc.combat.conditions.push({ condition: "jump", effects: [], jumps: { times: 3 } });
    doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0].creature.jump = jump;
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
  const reach = (definition: RulesetDefinition, conditions: string[] = []) => {
    const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
    const bulette = rulesetStatBlockFromCreature(definition, creature)!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "bulette", name: "Bulette", side: "enemy", block: { ...bulette, health: 90 } },
        {
          id: "other",
          name: "Other",
          side: "party",
          block: {
            health: 10,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
      board: {
        grid: { width: 30, height: 1, tiles: [Array(30).fill("plains")] } as never,
        placements: { bulette: { x: 0, y: 0 }, other: { x: 29, y: 0 } },
      },
    });
    const jumper = rulesetCombatant(state, "bulette")!;
    for (const condition of conditions) jumper.tracked.push({ condition, rounds: null } as never);
    return { block: bulette, reach: rulesetJumpReach(definition, state, jumper) };
  };

  // ── Standing Leap: 30 feet long (6 cells) and 15 high (3), standing ──
  {
    const { block, reach: got } = reach(parsed(fiveE()));
    assert.deepEqual(block.jump, leap);
    assert.deepEqual(got, { long: 6, high: 3, running: false });
  }
  // ── Without withoutRunUp, the ruleset's standing halves it ──
  assert.deepEqual(reach(parsed(fiveE({ long: 30, high: 15 }))).reach, { long: 3, high: 1, running: false });
  // ── Jump triples it ──
  assert.deepEqual(reach(parsed(fiveE()), ["jump"]).reach, { long: 18, high: 9, running: false });

  // ── Refusals ──
  refused(fiveE({ long: 30 }), /high/);
  refused(fiveE({ long: -5, high: 5 }), /long/);
  refused(fiveE({ long: 30, high: 15, withoutRunUp: false }), /withoutRunUp/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that jumps its own distance (creature.jump) requires schemaVersion 2 and capabilityApi 1.716 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(715) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(716) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(715) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Creature jump: a bulette's Standing Leap reaches 6 cells long and 3 high standing, half that without withoutRunUp, triple with Jump; gated at 1.716.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
