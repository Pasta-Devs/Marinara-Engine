/**
 * Abilities a condition changes (Capability API 1.515).
 *
 *   - On the sheet: a Potion of Hill Giant Strength sets Strength to 21, a higher score stays;
 *     Feeblemind makes Intelligence 1.
 *   - In a fight: drunk mid-fight, the drinker's Strength attacks and Strength save are worked out
 *     again, and again once it ends.
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
  evaluateRulesetSheetLive,
  parseRulesetDefinition,
  rulesetAbilityScore,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-condition-abilities-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 515);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const potion = { str: { set: 21 } };
  const document = (abilities: unknown = potion): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push(
      { id: "giant_strength", label: "Hill Giant Strength" },
      { id: "feebleminded", label: "Feebleminded" },
    );
    doc.combat.conditions.push(
      { condition: "giant_strength", effects: [], abilities },
      { condition: "feebleminded", effects: [], abilities: { int: { to: 1 }, cha: { to: 1 } } },
    );
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
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
  const build = (str: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str, dex: 10, con: 10, int: 14, wis: 10, cha: 12 },
      fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
    });
  const scores = (str: number, conditions: string[]) =>
    evaluateRulesetSheetLive(definition, build(str), { conditions }).abilityScores;

  // ── On the sheet ──
  assert.equal(scores(10, []).str, 10);
  assert.equal(scores(10, ["giant_strength"]).str, 21, "set to 21");
  assert.equal(scores(23, ["giant_strength"]).str, 23, "a higher score stays");
  assert.equal(scores(10, ["feebleminded"]).int, 1, "made 1");
  assert.equal(scores(10, ["feebleminded"]).cha, 1);
  assert.equal(scores(10, ["feebleminded"]).str, 10, "and nothing else");
  assert.equal(
    evaluateRulesetSheetLive(definition, build(10), {}, undefined, ["giant_strength"]).abilityScores.str,
    21,
  );

  // ── In a fight: drunk mid-fight, worked out again, and again as it ends ──
  const axe = {
    name: "Axe",
    quantity: 1,
    worn: true,
    item: {
      category: "gear",
      slots: { hands: 1 },
      attack: {
        budget: "action",
        toHit: { abilities: ["str"] },
        damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
      },
    } as RulesetCatalogItem,
  } as RulesetSheetItem;
  const fight = (live: Record<string, unknown> = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: build(10), live, items: [axe] },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 500,
            defense: 1,
            initiativeModifier: -20,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const hero = (state: RulesetEncounterState) => rulesetCombatant(state, "hero")!;
  const swing = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Axe");
    assert.ok(option, "no Axe");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option.id, targetIds: ["foe"] },
      (sides: number) => (sides === 20 ? 10 : 4),
    );
    const attack = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "attack" }> => one.type === "attack",
    );
    const damage = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage",
    );
    assert.ok(attack && damage, JSON.stringify(step.events));
    return { modifier: attack.modifier, amount: damage.amount };
  };
  {
    const plain = fight();
    const before = swing(plain);
    const saveBefore = hero(plain).saves?.str_save;
    const strong = fight();
    hero(strong).tracked.push({ condition: "giant_strength", rounds: 600, source: "hero" });
    // Anything that settles a step works the numbers out again: a spent move does.
    const settled = applyRulesetCombatChoice(
      definition,
      strong,
      { actorId: "hero", optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    assert.deepEqual(hero(settled).abilityConditions, ["giant_strength"]);
    assert.equal(rulesetAbilityScore(definition, hero(settled), "str"), 21);
    assert.equal(hero(settled).saves?.str_save, (saveBefore ?? 0) + 5, "+5 to the Strength save");
    settled.turn = settled.order.indexOf("hero");
    hero(settled).budgets.action = 1;
    const after = swing(settled);
    assert.equal(after.modifier, before.modifier + 5, "+5 to hit");
    assert.equal(after.amount, before.amount + 5, "+5 damage");
    // It ends: back as it was.
    hero(settled).tracked = hero(settled).tracked.filter((one) => one.condition !== "giant_strength");
    const ended = applyRulesetCombatChoice(
      definition,
      settled,
      { actorId: settled.order[settled.turn]!, optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    assert.equal(hero(ended).abilityConditions, undefined);
    assert.equal(hero(ended).saves?.str_save, saveBefore);
    assert.equal(rulesetAbilityScore(definition, hero(ended), "str"), 10);
  }
  {
    // Drunk mid-fight as the Engine puts it on: held, and written onto the sheet as well. The first
    // such condition is still worked out.
    const plain = fight();
    const before = swing(plain);
    const strong = fight();
    hero(strong).tracked.push({ condition: "giant_strength", rounds: 600, source: "hero" });
    hero(strong).sheet!.live = { ...hero(strong).sheet!.live, conditions: ["giant_strength"] };
    const settled = applyRulesetCombatChoice(
      definition,
      strong,
      { actorId: "hero", optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    assert.deepEqual(hero(settled).abilityConditions, ["giant_strength"]);
    settled.turn = settled.order.indexOf("hero");
    hero(settled).budgets.action = 1;
    const after = swing(settled);
    assert.equal(after.modifier, before.modifier + 5, "+5 to hit, though the sheet holds it too");
    assert.equal(after.amount, before.amount + 5, "+5 damage, though the sheet holds it too");
  }
  {
    // On a stat block with no sheet: Feeblemind on a monster, its scores and its saves.
    const state = fight();
    const foe = rulesetCombatant(state, "foe")!;
    foe.block = { ...foe.block!, abilities: { str: 10, int: 18, cha: 14 }, saves: { int_save: 6 } };
    foe.saves = { int_save: 6 };
    foe.tracked.push({ condition: "feebleminded", rounds: null, source: "hero" });
    const settled = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    const now = rulesetCombatant(settled, "foe")!;
    assert.deepEqual(now.abilityConditions, ["feebleminded"]);
    assert.equal(rulesetAbilityScore(definition, now, "int"), 1);
    assert.equal(rulesetAbilityScore(definition, now, "cha"), 1);
    assert.equal(now.saves.int_save, 6 - 9, "from +4 to -5");
    assert.equal(now.saves.cha_save, -7, "from +2 to -5, though it printed none");
    assert.equal(now.saves.str_save, undefined, "and nothing else");
    now.tracked = now.tracked.filter((one) => one.condition !== "feebleminded");
    const ended = applyRulesetCombatChoice(
      definition,
      settled,
      { actorId: settled.order[settled.turn]!, optionId: "end-turn", targetIds: [] },
      () => 10,
    ).state;
    const back = rulesetCombatant(ended, "foe")!;
    assert.equal(back.abilityScores, undefined);
    assert.equal(back.saves.int_save, 6, "back as printed");
    assert.equal(rulesetAbilityScore(definition, back, "int"), 18);
  }
  {
    // Drunk before the fight, on the sheet: the fight starts with it.
    const state = fight({ conditions: ["giant_strength"] });
    assert.equal(rulesetAbilityScore(definition, hero(state), "str"), 21);
    assert.equal(hero(state).saves?.str_save, (hero(fight()).saves?.str_save ?? 0) + 5);
  }

  // ── Refusals ──
  refused(document({ luck: { set: 18 } }), /Unknown ability "luck"/);
  refused(document({ str: { add: 0 } }), /Adding 0 changes nothing/);
  refused(document({ str: { to: 1, set: 2 } }), /abilities/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions change their holder's abilities (a combat condition's abilities) requires schemaVersion 2 and capabilityApi 1.515 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(514) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(515) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(514) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Condition abilities: a giant-strength potion sets Strength and a higher score stays, Feeblemind makes Intelligence 1, and a fighter's attacks and saves are worked out again as it comes and goes; gated at 1.515.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
