/**
 * A condition that gives way as its holder first sees somebody (Capability API 1.638): 5e's Philter of
 * Love, "The next time you see a creature within 10 minutes after drinking the philter, you become
 * charmed by that creature for 1 hour."
 *
 *   - It gives way to a charm from the nearest creature its holder sees.
 *   - Refused for an unknown condition; the install gate.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-first-seen-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 638);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (becomes = "charmed") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "love_struck", label: "Love-struck" });
    doc.combat.conditions.push({
      condition: "love_struck",
      effects: [],
      onFirstSeen: { applies: { condition: becomes, duration: { rounds: 600 } } },
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const goblin = (): RulesetStatBlock =>
    ({ health: 7, defense: 13, initiativeModifier: 0, speed: 30, actions: [] }) as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "bard",
        name: "Bard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
          fields: { level: 5, ac: 13, speed: 30, hp_max: 40 },
        }),
      },
      { id: "far", name: "Far Goblin", side: "enemy", block: goblin() },
      { id: "near", name: "Near Goblin", side: "enemy", block: goblin() },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) } as never,
      placements: { bard: { x: 2, y: 4 }, far: { x: 15, y: 4 }, near: { x: 5, y: 4 } },
    },
  });
  state.order = ["bard", "far", "near"];
  state.turn = 0;
  rulesetCombatant(state, "bard")!.tracked.push({ condition: "love_struck", rounds: 100 } as never);
  // Whatever happens next, the bard sees the goblins.
  const end = rulesetCombatOptions(definition, state, "bard").find((one) => one.kind === "end-turn")!;
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "bard", optionId: end.id, targetIds: [] },
    () => 10,
  );
  const bard = rulesetCombatant(step.state, "bard")!;
  assert.ok(!rulesetCombatConditions(definition, bard).includes("love_struck"), "given way");
  const charm = bard.tracked.find((one) => one.condition === "charmed");
  assert.ok(charm, JSON.stringify(step.events));
  assert.equal(charm.source, "near", "by the nearest it sees");
  assert.equal(charm.rounds, 600);

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document("smitten"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Unknown condition "smitten"/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that gives way as its holder first sees somebody (onFirstSeen) requires schemaVersion 2 and capabilityApi 1.638 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(637) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(638) as never, document()), gate);
  }

  console.log("onFirstSeen: a Philter of Love's drinker is charmed by the nearest creature they see; gated at 1.638.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
