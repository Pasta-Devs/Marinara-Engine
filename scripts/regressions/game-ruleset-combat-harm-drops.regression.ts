/**
 * A condition's harm its saves wear down (Capability API 1.635): 5e's Potion of Poison, "At the start
 * of each of your turns ... 3d6 poison damage ... On a successful save, the poison damage ...
 * decreases by 1d6. The poison ends when the damage decreases to 0."
 *
 *   - Failed: the dice left; saved: nothing, and a die off; with none left, it ends.
 *   - Refused with dice of another size; the install gate.
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
  type RulesetCombatEvent,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-harm-drops-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 635);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (drops = "1d6"): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "potion_poison", label: "Potion of Poison" });
    doc.combat.conditions.push({
      condition: "potion_poison",
      effects: [],
      harms: { at: "turn-start", dice: "3d6", type: "poison", save: { save: "con_save", difficulty: 13, drops } },
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  let state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "fighter",
        name: "Fighter",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 10, con: 10, int: 8, wis: 10, cha: 8 },
          fields: { level: 5, ac: 16, speed: 30, hp_max: 80 },
        }),
        live: {},
      },
      {
        id: "wolf",
        name: "Wolf",
        side: "enemy",
        block: {
          health: 11,
          defense: 13,
          initiativeModifier: 2,
          speed: 40,
          actions: [],
        } as unknown as RulesetStatBlock,
      },
    ],
  });
  state.order = ["wolf", "fighter"];
  state.turn = 0;
  rulesetCombatant(state, "fighter")!.tracked.push({ condition: "potion_poison", rounds: 600 } as never);
  const endTurn = (actorId: string, roller: (sides: number) => number) => {
    const end = rulesetCombatOptions(definition, state, actorId).find((one) => one.kind === "end-turn")!;
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: end.id, targetIds: [] }, roller);
  };
  /** The fighter's turn starts with their save's d20 on this face, every d6 a 3. */
  const fighterTurn = (d20: number) => {
    const step = endTurn("wolf", (sides) => (sides === 20 ? d20 : 3));
    state = step.state;
    const dealt = step.events
      .filter(
        (one): one is Extract<RulesetCombatEvent, { type: "damage" }> =>
          one.type === "damage" && one.targetId === "fighter",
      )
      .reduce((sum, one) => sum + one.amount, 0);
    state = endTurn("fighter", () => 10).state;
    return dealt;
  };
  const poisoned = () =>
    rulesetCombatConditions(definition, rulesetCombatant(state, "fighter")!).includes("potion_poison");

  assert.equal(fighterTurn(2), 9, "failed: 3d6");
  assert.equal(fighterTurn(19), 0, "saved: nothing, and a die less");
  assert.equal(fighterTurn(2), 6, "failed: 2d6");
  assert.equal(fighterTurn(19), 0);
  assert.ok(poisoned(), "a die still left");
  assert.equal(fighterTurn(2), 3, "failed: 1d6");
  assert.equal(fighterTurn(19), 0);
  assert.ok(!poisoned(), "over once the damage is down to nothing");

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document("1d4"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /drops/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition's harm its saves wear down (harms.save.drops) requires schemaVersion 2 and capabilityApi 1.635 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(634) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(635) as never, document()), gate);
  }

  console.log(
    "harms.save.drops: a Potion of Poison's 3d6 loses a die with each save and ends at none; gated at 1.635.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
