/**
 * A floor under defense (Capability API 1.406).
 *
 *   - Barkskin: a creature's 12 becomes 16; a shield's +2 on 15 stays 17; a hit says what it raised.
 *   - Mage Armor: 13 + Dexterity read off the sheet, the better of it and what the character wears.
 *   - A creature without a sheet reads a `const` off its block.
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
  rulesetDefenseAgainst,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-defense-floor-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 406);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.derived.push({
      id: "ac_mage_armor",
      label: "Armor Class under Mage Armor",
      op: "sum",
      of: [{ const: 13 }, { abilityMod: "dex" }],
    });
    doc.sheet.live.conditions.push(
      { id: "barkskin", label: "Barkskin" },
      { id: "mage_armored", label: "Mage Armor" },
      { id: "warded", label: "Warded" },
      { id: "shielded", label: "Shielded" },
    );
    doc.combat.conditions.push(
      { condition: "barkskin", effects: [], modifiers: [{ to: "defense", atLeast: 16 }] },
      { condition: "mage_armored", effects: [], modifiers: [{ to: "defense", atLeast: { derived: "ac_mage_armor" } }] },
      { condition: "warded", effects: [], modifiers: [{ to: "defense", atLeast: { const: 14 } }] },
      { condition: "shielded", effects: [], modifiers: [{ to: "defense", flat: 2 }] },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const block = (defense: number): RulesetStatBlock => ({
    health: 40,
    defense,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "blade", name: "Blade", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  const fight = (defense = 12, dex = 16, ac = 12): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "brute", name: "Brute", side: "enemy", block: block(defense) },
        { id: "wizard", name: "Wizard", side: "party", block: block(10) },
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex, con: 12, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac, speed: 30, hp_max: 20 },
          }),
          live: {},
        },
      ],
    });
    state.order = ["wizard", "brute", "mage"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hold = (state: RulesetEncounterState, id: string, ...conditions: string[]) => {
    for (const condition of conditions) who(state, id).tracked.push({ condition, rounds: null } as never);
  };
  const defenseOf = (state: RulesetEncounterState, id: string) =>
    rulesetDefenseAgainst(definition, definition.combat!, state, who(state, id), who(state, "wizard"));

  // ── Barkskin ──
  {
    const state = fight(12);
    assert.equal(defenseOf(state, "brute").defense, 12);
    hold(state, "brute", "barkskin");
    const raised = defenseOf(state, "brute");
    assert.equal(raised.defense, 16, "never below 16");
    assert.deepEqual(raised.guards, [{ condition: "barkskin", value: 4 }]);
    // The hit says so.
    const struck = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: "blade", targetIds: ["brute"] },
      () => 10,
    );
    const attack = struck.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    )!;
    assert.equal(attack.defense, 16, JSON.stringify(struck.events));
    assert.equal(attack.outcome, "miss", "10 against 16");
    // Already above it with a shield: the shield counts, the floor adds nothing.
    const high = fight(15);
    hold(high, "brute", "barkskin", "shielded");
    assert.equal(defenseOf(high, "brute").defense, 17);
    assert.deepEqual(defenseOf(high, "brute").guards, [{ condition: "shielded", value: 2 }]);
  }

  // ── Mage Armor, read off the sheet: 13 + Dex 16's +3 ──
  {
    const state = fight(12, 16, 12);
    assert.equal(defenseOf(state, "mage").defense, 12);
    hold(state, "mage", "mage_armored");
    assert.equal(defenseOf(state, "mage").defense, 16);
    // Better armor of its own: kept.
    const armored = fight(12, 16, 18);
    hold(armored, "mage", "mage_armored");
    assert.equal(defenseOf(armored, "mage").defense, 18);
    // Two floors: the higher.
    hold(state, "mage", "barkskin");
    assert.equal(defenseOf(state, "mage").defense, 16);
    const nimble = fight(12, 20, 12);
    hold(nimble, "mage", "mage_armored", "barkskin");
    assert.equal(defenseOf(nimble, "mage").defense, 18, "13 + 5 beats 16");
  }

  // ── A creature reads a const ──
  {
    const state = fight(10);
    hold(state, "brute", "warded");
    assert.equal(defenseOf(state, "brute").defense, 14);
  }

  // ── Refusals ──
  {
    const withModifier = (modifier: Record<string, unknown>) =>
      document((doc) => {
        doc.combat.conditions.at(-1).modifiers = [modifier];
      });
    refused(withModifier({ to: "attacks", atLeast: 3 }), /"atLeast" is a floor under defense only/);
    refused(withModifier({ to: "defense", atLeast: 16, flat: 1 }), /"atLeast" alone/);
    refused(withModifier({ to: "defense", atLeast: { derived: "nothing_here" } }), /nothing_here/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a floor under defense (a modifier to defense with atLeast) requires schemaVersion 2 and capabilityApi 1.406 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(405) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(406) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(405) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Defense floor: Barkskin's 16 under a creature's 12, not over a shield's 17; Mage Armor's 13 + Dex off the sheet, the better of it and the armor worn; a creature's const; gated at 1.406.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
