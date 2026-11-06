/**
 * A Periapt of Wound Closure (Capability API 1.688).
 *
 *   - A condition's `stabilizesWhenDying`: its holder, dying as their turn starts, is stable in place
 *     of the dying roll, whatever the die would have said.
 *   - A rest's dice `times`: each die's healing, Constitution included, made that much more.
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wound-closure-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 688);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "wound_closure", label: "Wound Closure" });
    doc.combat.conditions.push({ condition: "wound_closure", effects: [], stabilizesWhenDying: true });
    doc.sheet.fields.push({
      id: "hd_times",
      label: "Hit Die healing times",
      type: "number",
      min: 1,
      max: 4,
      default: 1,
      section: "combat",
    });
    doc.rests.find((rest: { id: string }) => rest.id === "short").dice = {
      pool: "hit_dice",
      die: { field: "hit_die" },
      add: { abilityMod: "con" },
      heals: "hp",
      times: { field: "hd_times" },
    };
    edit(doc);
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
  const build = (fields: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 4, ac: 16, speed: 30, hp_max: 40, hit_die: "d10", ...fields },
    });

  // ── Dying at turn start: stable, no roll ──
  {
    const ogre = { health: 30, defense: 5, initiativeModifier: 0, speed: 30, actions: [] } as RulesetStatBlock;
    const dyingRoll = (held: string[]) => {
      const state = createRulesetEncounter({
        definition,
        seed: 1,
        roller: () => 10,
        combatants: [
          { id: "c", name: "Cleric", side: "party", block: ogre },
          { id: "f", name: "Fighter", side: "party", build: build(), live: { pools: { hp: { value: 0 } } } },
          { id: "e", name: "Ogre", side: "enemy", block: ogre },
        ],
      });
      state.order = ["c", "f", "e"];
      state.turn = 0;
      for (const condition of held) rulesetCombatant(state, "f")!.tracked.push({ condition, rounds: null });
      // A 1 on the die: two failures, unless the periapt holds.
      const step = advanceRulesetTurn(definition, state, () => 1);
      const dying = step.events.filter(
        (one): one is Extract<RulesetCombatEvent, { type: "dying" }> => one.type === "dying",
      );
      assert.equal(dying.length, 1, JSON.stringify(step.events));
      return { event: dying[0]!, fighter: rulesetCombatant(step.state, "f")! };
    };
    const kept = dyingRoll(["wound_closure"]);
    assert.equal(kept.event.result, "stable");
    assert.deepEqual(kept.event.rolls, []);
    assert.equal(kept.fighter.stable, true);
    const plain = dyingRoll([]);
    assert.equal(plain.event.result, "failure");
    assert.equal(plain.fighter.stable ?? false, false);
  }

  // ── Hit dice healing doubled ──
  {
    const hurt = { pools: { hp: { value: 10 } } };
    const rest = (fields: Record<string, unknown>) =>
      applyRulesetSheetOp(definition, build(fields), hurt, { op: "rest", rest: "short", dice: 2 }, () => 7);
    const plain = rest({});
    assert.ok(plain.ok, JSON.stringify(plain));
    // Two d10s of 7, +2 Constitution each: 18.
    assert.equal(plain.live.pools?.hp?.value, 28);
    const doubled = applyRulesetSheetOp(
      definition,
      build({ hd_times: 2 }),
      { pools: { hp: { value: 2 } } },
      { op: "rest", rest: "short", dice: 2 },
      () => 7,
    );
    assert.ok(doubled.ok);
    assert.equal(doubled.live.pools?.hp?.value, 38, "36 in all");
    const wounded = applyRulesetSheetOp(
      definition,
      build({ hd_times: 2 }),
      { pools: { hp: { value: 2 } } },
      { op: "rest", rest: "short", dice: 1 },
      () => 7,
    );
    assert.ok(wounded.ok);
    assert.equal(wounded.live.pools?.hp?.value, 20);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.rests.find((rest: { id: string }) => rest.id === "short").dice.times = { field: "nosuch" })),
    /nosuch/,
  );
  refused(
    fiveE(
      (doc) =>
        (doc.combat.conditions.find((one: any) => one.condition === "wound_closure").stabilizesWhenDying = false),
    ),
    /stabilizesWhenDying/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition that stabilizes its dying holder, or rest dice that heal more (stabilizesWhenDying, a rest's dice times) requires schemaVersion 2 and capabilityApi 1.688 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(687) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(688) as never, fiveE()), gate);
    const restOnly = fiveE((doc) => doc.combat.conditions.pop());
    assert.equal(getCapabilityPackageInstallIssue(manifest(687) as never, restOnly), gate, "the rest's times alone");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(687) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Wound closure: stable when dying in place of the roll, hit dice healing doubled; gated at 1.688.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
