/**
 * A knight's Leadership (Capability API 1.608).
 *
 *   - An aura's `seenByHolder`: it reaches only whoever its holder can see.
 *   - Its `targetTypes.understands` (1.561) reads the holder's languages: an ally who shares none is
 *     left out.
 *   - `endsWhenHolder.incapacitated`, on the combat condition or on what applied it: it comes off
 *     once its holder holds anything with `cannot-act`.
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
  rulesetAuraReaches,
  rulesetCombatant,
  rulesetCombatOptions,
  supportedCapabilityApi,
  type RulesetConditionAura,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-leadership-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 608);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const aura = {
    distance: 30,
    side: "allies",
    self: true,
    conditions: ["led"],
    needs: ["hearing"],
    seenByHolder: true,
    targetTypes: { understands: true },
  };
  const fiveE = (
    ends: Record<string, unknown> = { incapacitated: true },
    leading: Record<string, unknown> = aura,
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "leadership", label: "Leadership" }, { id: "led", label: "Led" });
    doc.combat.conditions.push(
      { condition: "leadership", effects: [], auras: [leading], endsWhenHolder: ends },
      { condition: "led", effects: [] },
    );
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
  const block = (languages: string[]) =>
    ({
      health: 50,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      languages,
      actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 3, damage: { dice: "1d4", type: "bludgeoning" } }],
    }) as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const tiles = Array.from({ length: 6 }, () => Array(10).fill("plains"));
    // A wall between the knight and the one behind it.
    for (let y = 0; y < 6; y++) tiles[y]![5] = "wall";
    tiles[0]![5] = "plains";
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "knight", name: "Knight", side: "party", block: block(["common"]) },
        { id: "squire", name: "Squire", side: "party", block: block(["common"]) },
        { id: "ogre", name: "Ogre", side: "party", block: block(["giant"]) },
        { id: "hidden", name: "Hidden", side: "party", block: block(["common"]) },
        { id: "foe", name: "Foe", side: "enemy", block: block(["common"]) },
      ],
      board: {
        grid: { width: 10, height: 6, tiles },
        placements: {
          knight: { x: 3, y: 3 },
          squire: { x: 4, y: 3 },
          ogre: { x: 3, y: 4 },
          hidden: { x: 6, y: 4 },
          foe: { x: 9, y: 0 },
        },
      },
    });
    state.order = ["knight", "squire", "ogre", "hidden", "foe"];
    state.turn = 0;
    rulesetCombatant(state, "knight")!.tracked.push({ condition: "leadership", rounds: 10 });
    return state;
  };
  const rule = definition.combat!.conditions!.find((one) => one.condition === "leadership")!
    .auras![0] as RulesetConditionAura;

  // ── Who it reaches ──
  {
    const state = fight();
    const knight = rulesetCombatant(state, "knight")!;
    const reaches = (id: string) =>
      rulesetAuraReaches(definition, state, knight, rule, rulesetCombatant(state, id)!, "leadership");
    assert.equal(reaches("squire"), true, "seen and understanding");
    assert.equal(reaches("ogre"), false, "shares no language");
    assert.equal(reaches("hidden"), false, "behind a wall, unseen");
    assert.equal(reaches("knight"), true, "itself");
  }

  // ── Incapacitated, it ends ──
  {
    const state = fight();
    rulesetCombatant(state, "knight")!.tracked.push({ condition: "stunned", rounds: 1 });
    const end = rulesetCombatOptions(definition, state, "knight").find((one) => one.kind === "end-turn")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "knight", optionId: end.id, targetIds: [] },
      () => 10,
    );
    assert.ok(!rulesetCombatant(step.state, "knight")!.tracked.some((one) => one.condition === "leadership"));
    // Not while it can act.
    const awake = fight();
    const go = rulesetCombatOptions(definition, awake, "knight").find((one) => one.kind === "end-turn")!;
    const kept = applyRulesetCombatChoice(
      definition,
      awake,
      { actorId: "knight", optionId: go.id, targetIds: [] },
      () => 10,
    );
    assert.ok(rulesetCombatant(kept.state, "knight")!.tracked.some((one) => one.condition === "leadership"));
  }

  // ── Refusals ──
  refused(fiveE({ incapacitated: false }), /endsWhenHolder/);
  refused(fiveE({ incapacitated: true }, { ...aura, seenByHolder: false }), /seenByHolder/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that ends when its holder is incapacitated, or an aura only its holder's seen get (endsWhenHolder.incapacitated, aura.seenByHolder), requires schemaVersion 2 and capabilityApi 1.608 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(607) as never, fiveE()), gate);
    const { seenByHolder: _unused, ...plain } = aura;
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(607) as never, fiveE({ downed: true }, plain)), gate);
    assert.equal(getCapabilityPackageInstallIssue(manifest(607) as never, fiveE({ downed: true })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(608) as never, fiveE()), gate);
  }

  console.log(
    "Leadership: reaches whom its holder sees and who understands it, ends when its holder is incapacitated; gated at 1.608.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
