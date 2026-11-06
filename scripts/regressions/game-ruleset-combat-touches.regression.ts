/**
 * A touch answered (Capability API 1.527).
 *
 *   - Heated Body: a grapple or a shove at its holder costs the one who tried 1d10 fire, won or lost,
 *     as a melee hit does; a condition without `touches` answers only the hit.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-touches-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 527);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shield = { blow: "melee", within: 5, harms: { dice: "2d8", damageType: "fire" } };
  const heated = { blow: "melee", within: 5, touches: true, harms: { dice: "1d10", damageType: "fire" } };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "fire_shield", label: "Fire Shield" },
      { id: "marked", label: "Marked" },
      { id: "brand", label: "Brand" },
      { id: "heated", label: "Heated Body" },
    );
    doc.combat.conditions.push(
      { condition: "fire_shield", effects: [], whenHit: shield },
      { condition: "marked", effects: [] },
      { condition: "brand", effects: [], whenHit: { applies: [{ condition: "marked", duration: "instant" }] } },
      { condition: "heated", effects: [], whenHit: heated },
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

  // ── Grappled or shoved: 1d10 fire on whoever tried, won or lost ──
  for (const roll of [18, 2]) {
    const tried = strike(fight("heated"), "contest:grapple", roll);
    assert.ok(of(tried.events, "contest").length > 0, JSON.stringify(tried.events));
    const back = hurt(tried.events, "ogre");
    assert.equal(back.length, 1, `roll ${roll}: ${JSON.stringify(tried.events)}`);
    assert.equal(back[0]!.damageType, "fire");
    assert.equal(back[0]!.sourceId, "wizard");
  }
  // ── Still a melee hit too ──
  assert.equal(hurt(strike(fight("heated"), "stab", 15).events, "ogre").length, 1, "a hit");
  // ── Fire Shield answers no grapple ──
  assert.equal(hurt(strike(fight("fire_shield"), "contest:grapple", 18).events, "ogre").length, 0, "no touches");

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "heated").whenHit.blow = "ranged")),
    /A touch is made in reach/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions answer whoever touches their holder (whenHit touches) requires schemaVersion 2 and capabilityApi 1.527 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(526) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(527) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(526) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Touches: Heated Body burns whoever grapples its holder, won or lost, and a melee hitter; Fire Shield answers no grapple; gated at 1.527.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
