/**
 * A save on damage that leans (Capability API 1.712): 5e's Hideous Laughter, saved against at the end
 * of each turn and, with advantage, each time its holder takes damage.
 *
 *   - `saveWhenDamaged: {lean: "advantage"}`: the save damage brings is rolled with advantage.
 *   - `saveWhenDamaged: true` still rolls it plainly.
 *   - Import refusals and the install gate.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-damaged-save-lean-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 712);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (saveWhenDamaged: unknown): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "laughing", label: "Hideous Laughter" });
    doc.combat.conditions.push({ condition: "laughing", effects: [], saveWhenDamaged });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = (actions: unknown[]): RulesetStatBlock =>
    ({ health: 80, defense: 5, initiativeModifier: 0, speed: 30, actions }) as unknown as RulesetStatBlock;
  // The first d20 a 4 and every one after a 17; every other die a 3.
  const saveAfterHit = (definition: RulesetDefinition) => {
    let d20s = 0;
    const roll = (sides: number) => (sides === 20 ? (d20s++ === 0 ? 17 : d20s === 2 ? 4 : 17) : 3);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "bard",
          name: "Bard",
          side: "enemy",
          block: block([{ id: "jab", name: "Jab", budget: "action", toHit: 10, damage: { flat: 2 }, reach: 5 }]),
        },
        { id: "ogre", name: "Ogre", side: "party", block: block([]) },
      ],
    });
    state.order = ["bard", "ogre"];
    state.turn = 0;
    rulesetCombatant(state, "ogre")!.tracked.push({
      condition: "laughing",
      rounds: 10,
      source: "bard",
      difficulty: 15,
      saveEnds: { save: "wis_save", at: "turn-end" },
    });
    const option = rulesetCombatOptions(definition, state, "bard").find((one) => one.label === "Jab")!;
    assert.ok(option);
    d20s = 0;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "bard", optionId: option.id, targetIds: ["ogre"] },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    const [save] = of(step.events, "save");
    assert.ok(save, JSON.stringify(step.events));
    return { save, held: rulesetCombatant(step.state, "ogre")!.tracked.some((one) => one.condition === "laughing") };
  };

  // ── With advantage: 4 and 17, the 17 kept, and the laughter ends ──
  {
    const { save, held } = saveAfterHit(parsed(fiveE({ lean: "advantage" })));
    assert.equal(save.mode, "advantage");
    assert.deepEqual(save.rolls, [4, 17]);
    assert.equal(save.kept, 17);
    assert.equal(save.success, true);
    assert.equal(held, false);
  }

  // ── Plainly: the 4 alone, and it holds ──
  {
    const { save, held } = saveAfterHit(parsed(fiveE(true)));
    assert.equal(save.mode, undefined);
    assert.deepEqual(save.rolls, [4]);
    assert.equal(save.success, false);
    assert.equal(held, true);
  }

  // ── With disadvantage ──
  {
    const { save } = saveAfterHit(parsed(fiveE({ lean: "disadvantage" })));
    assert.equal(save.mode, "disadvantage");
    assert.equal(save.kept, 4);
  }

  // ── Refusals ──
  refused(fiveE({}), /saveWhenDamaged/);
  refused(fiveE({ lean: "sideways" }), /saveWhenDamaged/);
  refused(fiveE({ lean: "advantage", more: true }), /saveWhenDamaged/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition saved against on damage with a lean (saveWhenDamaged.lean) requires schemaVersion 2 and capabilityApi 1.712 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(711) as never, fiveE({ lean: "advantage" })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(712) as never, fiveE({ lean: "advantage" })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(711) as never, fiveE(true)), gate);
  }

  console.log(
    "Damaged save lean: Hideous Laughter's save on damage rolls 4 and 17 with advantage and ends it; plainly the 4 holds it; gated at 1.712.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
