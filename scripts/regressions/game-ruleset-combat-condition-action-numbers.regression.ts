/**
 * A condition's entry used at numbers of its own (Capability API 1.634): 5e's Potion of Animal
 * Friendship, "you can cast the animal friendship spell (save DC 13) for 1 hour at will".
 *
 *   - A fighter with no spellcasting, holding the potion's condition, casts it at DC 13.
 *   - Refused below 0; the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-numbers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 634);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (fixed: Record<string, unknown> = { saveDifficulty: 13 }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "animal_friend", label: "Animal friend" },
      { id: "befriended", label: "Befriended" },
    );
    doc.combat.conditions.push(
      { condition: "animal_friend", effects: [], actions: [{ entry: "spells/befriend", ...fixed }] },
      { condition: "befriended", effects: [] },
    );
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "befriend",
          label: "Befriend",
          rows: [{ list: "spells", values: { name: "Befriend", level: 1, prepared: true } }],
          mechanics: {
            kind: "debuff",
            targets: "enemy",
            budget: "action",
            range: 30,
            save: { save: "wis_save", onSuccess: "negates" },
            applies: [{ condition: "befriended", duration: { rounds: 600 } }],
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
  const definition = parsed(document());
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "fighter",
        name: "Fighter",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
          fields: { level: 5, ac: 16, speed: 30, hp_max: 44 },
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
  state.order = ["fighter", "wolf"];
  state.turn = 0;
  rulesetCombatant(state, "fighter")!.tracked.push({ condition: "animal_friend", rounds: 600 } as never);
  const option = rulesetCombatOptions(definition, state, "fighter").find((one) => one.label === "Befriend");
  assert.ok(
    option,
    rulesetCombatOptions(definition, state, "fighter")
      .map((one) => one.label)
      .join(", "),
  );
  const step = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "fighter", optionId: option.id, targetIds: ["wolf"] },
    () => 5,
  );
  const save = step.events.find((one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save");
  assert.equal(save?.difficulty, 13, JSON.stringify(step.events));
  assert.ok(rulesetCombatConditions(definition, rulesetCombatant(step.state, "wolf")!).includes("befriended"));

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document({ saveDifficulty: -1 }));
    assert.equal(result.ok, false);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition's entry used at numbers of its own (actions with entry and saveDifficulty or toHit) requires schemaVersion 2 and capabilityApi 1.634 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(633) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(634) as never, document()), gate);
  }

  console.log(
    "Condition actions at numbers of their own: a potion's spell cast at DC 13 by a fighter; gated at 1.634.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
