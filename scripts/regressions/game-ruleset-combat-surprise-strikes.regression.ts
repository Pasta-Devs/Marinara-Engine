/**
 * Strikes at a surprised or not-yet-acted target (Capability API 1.544).
 *
 *   - A condition's change to attacks with `whenTarget` "not-yet-acted": Assassinate's advantage on
 *     a creature that has not taken a turn in the fight, gone once it has.
 *   - `critical` with `whenTarget` "surprised": any hit on a surprised creature is a critical.
 *   - A change to damage with `whenTarget`: a bugbear's Surprise Attack, 2d6 more.
 *   - A creature's `attackModes` `whenTarget`, and a rider `when` "target-surprised".
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-surprise-strikes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 544);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const assassinate = [
    { to: "attacks", mode: "advantage", whenTarget: "not-yet-acted" },
    { to: "attacks", critical: true, whenTarget: "surprised" },
    { to: "damage", flat: 7, whenTarget: "surprised" },
  ];
  const fiveE = (modifiers: unknown[] = assassinate, creature: Record<string, unknown> = {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "assassin", label: "Assassin" });
    doc.combat.conditions.push({ condition: "assassin", effects: [], modifiers });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "killer",
        label: "Killer",
        creature: {
          health: 50,
          defense: 12,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_1",
          actions: [{ id: "knife", name: "Knife", budget: "action", toHit: 5, damage: { flat: 3 }, reach: 5 }],
          keepsOn: ["assassin"],
          ...creature,
        },
      });
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
  const fight = (definition: RulesetDefinition, surprised: boolean) => {
    const killer = rulesetCreatureBlock(
      definition,
      definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "killer"),
    );
    assert.ok(killer);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "killer", name: "Killer", side: "enemy", block: killer },
        {
          id: "mark",
          name: "Mark",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 10, speed: 30, hp_max: 40 },
          }),
        },
      ],
      board: {
        grid: { width: 8, height: 8, tiles: Array.from({ length: 8 }, () => Array(8).fill("plains")) },
        placements: { killer: { x: 3, y: 3 }, mark: { x: 4, y: 3 } },
      },
    });
    state.order = ["killer", "mark"];
    state.turn = 0;
    state.tookTurn = ["killer"];
    if (surprised) rulesetCombatant(state, "mark")!.surprised = true;
    return state;
  };
  const stab = (definition: RulesetDefinition, state: RulesetEncounterState) => {
    state.turn = state.order.indexOf("killer");
    rulesetCombatant(state, "killer")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "killer").find((one) => one.label === "Knife");
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "killer", optionId: option.id, targetIds: ["mark"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    const attack = of(step.events, "attack")[0]!;
    const dealt = of(step.events, "damage").reduce((sum, one) => sum + one.dealt, 0);
    return { mode: attack.mode, outcome: attack.outcome, dealt, step };
  };
  const definition = parsed(fiveE());

  // ── Surprised, and not yet acted: advantage, a critical, and 7 more ──
  {
    const blow = stab(definition, fight(definition, true));
    assert.equal(blow.mode, "advantage");
    assert.equal(blow.outcome, "critical");
    assert.equal(blow.dealt, 10, "3 and Surprise Attack's 7");
  }
  // ── Not surprised, not yet acted: advantage alone ──
  {
    const blow = stab(definition, fight(definition, false));
    assert.equal(blow.mode, "advantage");
    assert.equal(blow.outcome, "hit");
    assert.equal(blow.dealt, 3);
  }
  // ── Once it has taken a turn: nothing ──
  {
    const state = fight(definition, false);
    state.tookTurn = ["killer", "mark"];
    const blow = stab(definition, state);
    assert.equal(blow.mode, "normal");
    assert.equal(blow.outcome, "hit");
  }

  // ── A creature's own attack mode, and a rider on a surprised target ──
  {
    const own = parsed(
      fiveE([{ to: "defense", flat: 1 }], {
        attackModes: [{ mode: "advantage", whenTarget: "surprised" }],
        riders: [
          { id: "ambush", name: "Ambush", on: "hit", when: ["target-surprised"], oncePer: "turn", amount: { flat: 4 } },
        ],
      }),
    );
    const caught = stab(own, fight(own, true));
    assert.equal(caught.mode, "advantage");
    assert.equal(caught.dealt, 7, "3 and the rider's 4");
    const seen = stab(own, fight(own, false));
    assert.equal(seen.mode, "normal");
    assert.equal(seen.dealt, 3);
  }

  // ── Refusals ──
  refused(fiveE([{ to: "defense", flat: 1, whenTarget: "surprised" }]), /"whenTarget" narrows/);
  refused(fiveE([{ to: "damage", flat: 1, critical: true }]), /"critical" makes/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with attacks or damage narrowed to a surprised or not-yet-acted target (whenTarget, target-surprised, target-not-yet-acted) or hits made criticals (critical) requires schemaVersion 2 and capabilityApi 1.544 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(543) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(544) as never, fiveE()), gate);
  }

  console.log(
    "Surprise strikes: advantage on a creature yet to act, a critical and 2d6-like more on a surprised one, gone once it has acted; a creature's attack mode and a rider on a surprised target; refusals; gated at 1.544.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
