/**
 * Illusory duplicates (Capability API 1.505).
 *
 *   - A d20 at or over the threshold for how many are left turns an attack onto a duplicate, rolled
 *     against 10 + the holder's Dexterity modifier; a hit destroys it and deals nothing.
 *   - Under the threshold, the attack is the holder's as ever; the last duplicate ends the condition.
 *   - An attacker with blindsight in range is never fooled.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mirror-image-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 505);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const duplicates = {
    count: 3,
    thresholds: [11, 8, 6],
    defense: { flat: 10, ability: "dex" },
    pierced: ["blindsight"],
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "mirror_image", label: "Mirror Image" });
    doc.combat.conditions.push({ condition: "mirror_image", effects: [], duplicates });
    doc.combat.senses = [{ id: "blindsight", label: "Blindsight", blind: true }];
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
  const block = (senses?: Record<string, number>): RulesetStatBlock =>
    ({
      health: 60,
      defense: 18,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      ...(senses ? { senses } : {}),
      actions: [
        { id: "stab", name: "Stab", budget: "action", toHit: 0, damage: { count: 1, sides: 4, flat: 0 }, reach: 5 },
      ],
    }) as unknown as RulesetStatBlock;
  const fight = (senses?: Record<string, number>, left?: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ogre", name: "Ogre", side: "enemy", block: block(senses) },
        { id: "wizard", name: "Wizard", side: "party", block: block() },
      ],
      board: {
        grid: { width: 5, height: 3, tiles: Array.from({ length: 3 }, () => Array(5).fill("plains")) } as never,
        placements: { ogre: { x: 1, y: 1 }, wizard: { x: 2, y: 1 } },
      },
    });
    state.order = ["ogre", "wizard"];
    state.turn = 0;
    rulesetCombatant(state, "wizard")!.tracked.push({
      condition: "mirror_image",
      rounds: 10,
      ...(left !== undefined ? { duplicatesLeft: left } : {}),
    });
    return state;
  };
  // The dice in order: the duplicates' d20, the attack's d20, then its damage.
  const strike = (state: RulesetEncounterState, rolls: number[]) => {
    const queue = [...rolls];
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ogre", optionId: "stab", targetIds: ["wizard"] },
      () => queue.shift() ?? 1,
    );
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const image = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "wizard")!.tracked.find((one) => one.condition === "mirror_image");
  const health = (state: RulesetEncounterState) => rulesetCombatant(state, "wizard")!.health.value;

  // ── Three left: a 6 turns the attack onto one, rolled against 10 + 2 ──
  {
    const hit = strike(fight(), [6, 12, 4]);
    const said = of(hit.events, "duplicate");
    assert.deepEqual(
      said.map((one) => [one.roll, one.needed, one.diverted, one.lost ?? false, one.left ?? null]),
      [
        [6, 6, true, false, null],
        [6, 6, true, true, 2],
      ],
      JSON.stringify(hit.events),
    );
    assert.equal(of(hit.events, "attack")[0]!.defense, 12);
    assert.equal(of(hit.events, "attack")[0]!.outcome, "hit");
    assert.equal(of(hit.events, "damage").length, 0, "the duplicate takes the blow");
    assert.equal(health(hit.state), 60);
    assert.equal(image(hit.state)?.duplicatesLeft, 2);
    // Missing the duplicate leaves it there.
    const missed = strike(fight(), [6, 11, 4]);
    assert.equal(of(missed.events, "attack")[0]!.outcome, "miss");
    assert.equal(image(missed.state)?.duplicatesLeft, undefined);
  }

  // ── Two left need an 8: a 7 finds the wizard, against their own defense ──
  {
    const real = strike(fight(undefined, 2), [7, 18, 4]);
    assert.deepEqual(
      of(real.events, "duplicate").map((one) => [one.needed, one.diverted]),
      [[8, false]],
    );
    assert.equal(of(real.events, "attack")[0]!.defense, 18);
    assert.equal(health(real.state), 56);
    assert.equal(image(real.state)?.duplicatesLeft, 2);
  }

  // ── The last one, at 11, ends the condition ──
  {
    const last = strike(fight(undefined, 1), [11, 15, 4]);
    assert.equal(of(last.events, "duplicate").at(-1)?.left, 0);
    assert.equal(image(last.state), undefined, "no duplicates, no Mirror Image");
    assert.equal(health(last.state), 60);
  }

  // ── Blindsight in range sees through them: no roll at all ──
  {
    const blind = strike(fight({ blindsight: 30 }), [18, 4]);
    assert.equal(of(blind.events, "duplicate").length, 0);
    assert.equal(of(blind.events, "attack")[0]!.defense, 18);
    assert.equal(health(blind.state), 56);
  }

  // ── Refusals ──
  const withRule = (rule: Record<string, unknown>) =>
    fiveE((doc) => (doc.combat.conditions.find((one: any) => one.condition === "mirror_image").duplicates = rule));
  refused(withRule({ ...duplicates, thresholds: [11, 8] }), /one threshold for each number/);
  refused(withRule({ ...duplicates, thresholds: [11, 8, 26] }), /a face of its die/);
  refused(withRule({ ...duplicates, defense: { flat: 10, ability: "luck" } }), /Unknown ability "luck"/);
  refused(withRule({ ...duplicates, pierced: ["tremorsense"] }), /Unknown sense "tremorsense"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions make illusory duplicates that draw attacks (a condition's duplicates) requires schemaVersion 2 and capabilityApi 1.505 or newer";
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
    doc.combat.conditions[0].duplicates = duplicates;
    assert.equal(getCapabilityPackageInstallIssue(manifest(504) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(505) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(504) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Mirror Image: duplicates draw attacks on a d20 by how many are left, die when hit and end the condition with the last, and never fool blindsight; gated at 1.505.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
