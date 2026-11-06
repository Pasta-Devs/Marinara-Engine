/**
 * Poisons on a weapon: hits that deal damage and ask a save (Capability API 1.683).
 *
 *   - A condition's `onHit.damage` and `onHit.save`: serpent venom's 10 poison, halved on a made
 *     save; `onSuccess: "negates"` deals nothing when it is made. What it `applies` goes on only on a
 *     failure.
 *   - `onHit.failedBy`: drow poison, poisoned on a failure, unconscious as well on a failure by 5.
 *   - `onHit.damageTypes`: only a hit of those damage types carries it.
 *   - Import refusals, and the install gate.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-poison-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 683);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const venom = {
    weapon: true,
    damage: { flat: 10, type: "poison" },
    save: { save: "con_save", difficulty: 11, onSuccess: "half" },
  };
  const fiveE = (rule: unknown = venom): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "coated", label: "Coated Blade" });
    doc.combat.conditions.push({ condition: "coated", effects: [], onHit: rule });
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
  const block = (type = "piercing"): RulesetStatBlock =>
    ({
      health: 80,
      defense: 15,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        {
          id: "blade",
          name: "Blade",
          budget: "action",
          toHit: 5,
          damage: { count: 1, sides: 4, flat: 0, type },
          reach: 5,
        },
      ],
    }) as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  /** The rogue's coated blade hits the foe, every die showing `face`. */
  const stab = (rule: unknown, face: number, type = "piercing") => {
    const definition = parsed(fiveE(rule));
    const state: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "rogue", name: "Rogue", side: "party", block: block(type) },
        { id: "ally", name: "Ally", side: "party", block: block() },
        { id: "foe", name: "Foe", side: "enemy", block: block() },
      ],
      board: {
        grid: { width: 5, height: 1, tiles: [Array(5).fill("plains")] } as never,
        placements: { rogue: { x: 1, y: 0 }, foe: { x: 2, y: 0 }, ally: { x: 4, y: 0 } },
      },
    });
    state.order = ["rogue", "foe", "ally"];
    state.turn = 0;
    rulesetCombatant(state, "rogue")!.tracked.push({ condition: "coated", rounds: null });
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "rogue", optionId: "blade", targetIds: ["foe"] },
      () => face,
    );
    assert.equal(of(step.events, "attack")[0]?.outcome, "hit", JSON.stringify(step.events));
    const poison = of(step.events, "damage").filter((one) => one.label === "Coated Blade");
    const holds = rulesetCombatant(step.state, "foe")!
      .tracked.map((one) => one.condition)
      .filter((one) => one !== "coated");
    return { poison, holds, saves: of(step.events, "save") };
  };

  // ── Serpent venom: DC 11, made on a 12, half of 10 ──
  {
    const made = stab(venom, 12);
    assert.equal(made.saves.length, 1);
    assert.equal(made.poison.length, 1, "the venom's own damage");
    assert.equal(made.poison[0]!.amount, 5);
    assert.equal(made.poison[0]!.damageType, "poison");
    // Failed at DC 15: all of it.
    const failed = stab({ ...venom, save: { ...venom.save, difficulty: 15 } }, 12);
    assert.equal(failed.poison[0]!.amount, 10);
  }
  // ── Made with negates: nothing dealt, nothing put on ──
  {
    const rule = {
      ...venom,
      save: { ...venom.save, onSuccess: "negates" },
      applies: [{ condition: "poisoned", duration: { rounds: 10 } }],
    };
    const made = stab(rule, 12);
    assert.equal(made.poison.length, 0);
    assert.deepEqual(made.holds, []);
    const failed = stab({ ...rule, save: { ...rule.save, difficulty: 14 } }, 12);
    assert.equal(failed.poison[0]!.amount, 10);
    assert.deepEqual(failed.holds, ["poisoned"]);
  }
  // ── Drow poison: poisoned on a failure, unconscious as well on a failure by 5 ──
  {
    const drow = (difficulty: number) => ({
      weapon: true,
      save: { save: "con_save", difficulty, onSuccess: "negates" },
      applies: [{ condition: "poisoned", duration: { rounds: 600 } }],
      failedBy: { atLeast: 5, applies: [{ condition: "unconscious", duration: { rounds: 600 } }] },
    });
    assert.deepEqual(stab(drow(12), 12).holds, [], "made");
    assert.deepEqual(stab(drow(16), 12).holds, ["poisoned"], "failed by 4");
    assert.deepEqual(stab(drow(17), 12).holds.sort(), ["poisoned", "unconscious"], "failed by 5");
  }
  // ── Only a slashing or piercing blow carries it ──
  {
    const rule = { ...venom, damageTypes: ["slashing", "piercing"] };
    assert.equal(stab(rule, 12).poison.length, 1);
    const blunt = stab(rule, 12, "bludgeoning");
    assert.equal(blunt.poison.length, 0);
    assert.equal(blunt.saves.length, 0, "no save asked");
  }

  // ── Refusals ──
  refused(fiveE({ weapon: true }), /onHit applies something, deals damage, or both/);
  refused(fiveE({ ...venom, save: { ...venom.save, save: "luck_save" } }), /Unknown save "luck_save"/);
  refused(
    fiveE({ ...venom, failedBy: { atLeast: 5, applies: [{ condition: "comatose", duration: "instant" }] } }),
    /Unknown condition "comatose"/,
  );
  refused(
    fiveE({
      weapon: true,
      damage: venom.damage,
      failedBy: { atLeast: 5, applies: [{ condition: "poisoned", duration: "instant" }] },
    }),
    /"failedBy" reads onHit's own save/,
  );
  refused(fiveE({ weapon: true, damage: { type: "poison" } }), /The damage names dice, a flat amount, or both/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a condition whose holder's hits deal damage or ask a save (onHit damage, save, failedBy, damageTypes) requires schemaVersion 2 and capabilityApi 1.683 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(682) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(683) as never, fiveE()), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(682) as never,
        fiveE({ weapon: true, applies: [{ condition: "poisoned", duration: "instant" }] }),
      ),
      gate,
    );
  }

  console.log(
    "Weapon poison: a hit's own damage halved or negated on a save, worse on a bad failure, only on the right blows; gated at 1.683.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
