/**
 * Harm dealt back on a hit (Capability API 1.508).
 *
 *   - Fire Shield: a melee hit from within 5 feet costs the hitter 2d8 fire, no save, after the blow.
 *   - Not a ranged hit, nor a melee one from farther off, nor a miss.
 *   - `applies` with no save goes on unasked.
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
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hit-back-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 508);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shield = { blow: "melee", within: 5, harms: { dice: "2d8", damageType: "fire" } };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "fire_shield", label: "Fire Shield" },
      { id: "marked", label: "Marked" },
      { id: "brand", label: "Brand" },
    );
    doc.combat.conditions.push(
      { condition: "fire_shield", effects: [], whenHit: shield },
      { condition: "marked", effects: [] },
      { condition: "brand", effects: [], whenHit: { applies: [{ condition: "marked", duration: "instant" }] } },
    );
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
  const block = (): RulesetStatBlock =>
    ({
      health: 60,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      actions: [
        { id: "stab", name: "Stab", budget: "action", toHit: 0, damage: { flat: 3 }, reach: 5 },
        { id: "pike", name: "Pike", budget: "action", toHit: 0, damage: { flat: 3 }, reach: 10 },
        { id: "bolt", name: "Bolt", budget: "action", toHit: 0, damage: { flat: 3 }, range: { normal: 120 } },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (condition: string, away = 1): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block() },
        { id: "wizard", name: "Wizard", side: "party", block: block() },
      ],
      board: {
        grid: { width: 8, height: 3, tiles: Array.from({ length: 3 }, () => Array(8).fill("plains")) } as never,
        placements: { ogre: { x: 1, y: 1 }, wizard: { x: 1 + away, y: 1 } },
      },
    });
    state.order = ["ogre", "wizard"];
    state.turn = 0;
    rulesetCombatant(state, "wizard")!.tracked.push({ condition, rounds: 10 });
    return state;
  };
  const strike = (state: RulesetEncounterState, optionId: string, roll = 15) =>
    applyRulesetCombatChoice(definition, state, { actorId: "ogre", optionId, targetIds: ["wizard"] }, () => roll);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const hurt = (events: RulesetCombatEvent[], id: string) => of(events, "damage").filter((one) => one.targetId === id);

  // ── A melee hit from the next cell: 2d8 fire on the ogre, after the wizard's own hurt ──
  {
    const hit = strike(fight("fire_shield"), "stab", 7);
    assert.equal(of(hit.events, "attack")[0]?.outcome, "hit");
    const back = hurt(hit.events, "ogre");
    assert.equal(back.length, 1, JSON.stringify(hit.events));
    assert.equal(back[0]!.damageType, "fire");
    assert.equal(back[0]!.amount, 14);
    assert.equal(back[0]!.sourceId, "wizard");
    const order = hit.events.map((one) => (one.type === "damage" ? one.targetId : "")).filter(Boolean);
    assert.deepEqual(order, ["wizard", "ogre"], "the blow lands first");
  }

  // ── Not from 10 feet, not a bolt, not a miss ──
  {
    assert.equal(hurt(strike(fight("fire_shield", 2), "pike").events, "ogre").length, 0, "beyond 5 feet");
    assert.equal(hurt(strike(fight("fire_shield", 3), "bolt").events, "ogre").length, 0, "a ranged hit");
    const miss = strike(fight("fire_shield"), "stab", 2);
    assert.equal(of(miss.events, "attack")[0]?.outcome, "miss");
    assert.equal(hurt(miss.events, "ogre").length, 0);
  }

  // ── Applies with no save: on unasked ──
  {
    const branded = strike(fight("brand"), "stab");
    assert.equal(of(branded.events, "save").length, 0);
    assert.ok(rulesetCombatant(branded.state, "ogre")!.tracked.some((one) => one.condition === "marked"));
  }

  // ── Refusals ──
  const withRule = (rule: Record<string, unknown>) =>
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "fire_shield").whenHit = rule));
  refused(withRule({ blow: "melee" }), /whenHit does something/);
  refused(withRule({ harms: {} }), /harms says how much/);
  refused(withRule({ save: { save: "dex_save" }, harms: { flat: 1 } }), /goes with applies/);
  refused(withRule({ harms: { flat: 1, damageType: "sparkly" } }), /Unknown damage type "sparkly"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions harm whoever hits their holder, only so near, or with no save (whenHit harms, within, or no save) requires schemaVersion 2 and capabilityApi 1.508 or newer";
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
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.conditions[0].whenHit = shield;
    assert.equal(getCapabilityPackageInstallIssue(manifest(507) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(508) as never, doc), gate);
    const old = JSON.parse(fiveEText) as Record<string, any>;
    old.combat.conditions[0].whenHit = { save: { save: "con_save" }, applies: [{ condition: "prone" }] };
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(507) as never, old), gate, "1.489's shape");
  }

  console.log(
    "Hit back: Fire Shield burns a melee hitter within 5 feet for 2d8 with no save after the blow, not a far or ranged one or a miss; applies with no save; gated at 1.508.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
