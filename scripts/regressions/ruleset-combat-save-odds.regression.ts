/** The chance each target fails a save, on a save option's target buttons (playtest): Hold Person's
 *  target buttons showed only health. Read the way the save is thrown: the target's own modifier
 *  against the difficulty, rolled twice where its conditions say so; nought for one with a Legendary
 *  Resistance left, one for a thing, which has no save to make. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSaveFailChances,
  type RulesetCombatAction,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8")),
);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
  health: 30,
  defense: 12,
  initiativeModifier: 0,
  speed: 30,
  actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
  ...extra,
});
const state = createRulesetEncounter({
  definition,
  seed: 1,
  roller: () => 10,
  combatants: [
    { id: "mage", name: "Mage", side: "party", block: block() },
    { id: "a", name: "A", side: "enemy", block: block() },
    { id: "b", name: "B", side: "enemy", block: block() },
    { id: "boss", name: "Boss", side: "enemy", block: block({ legendaryResistance: 3 } as Partial<RulesetStatBlock>) },
  ],
});
const save = "dex_save";
const mage = rulesetCombatant(state, "mage")!;
const claw = mage.actions[0]!;
const { toHit: _toHit, ...rest } = claw;
mage.actions.push({
  ...rest,
  id: "hold",
  label: "Hold",
  save: { save, difficulty: 15, onSuccess: "negates" },
} as RulesetCombatAction);
rulesetCombatant(state, "a")!.saves[save] = 2;
rulesetCombatant(state, "b")!.saves[save] = 2;
rulesetCombatant(state, "b")!.flags.dodging = true;
const odds = () => rulesetSaveFailChances(definition, state, "mage", "hold", ["a", "b", "boss"]);

// d20 + 2 short of 15 on 1-12: 60%.
assert.equal(odds().a, 0.6);
// A Legendary Resistance left turns the failure into a success.
assert.equal(odds().boss, 0, JSON.stringify(rulesetCombatant(state, "boss")!.block));
rulesetCombatant(state, "boss")!.legendaryResisted = 3;
assert.notEqual(odds().boss, 0, "none left");
// Dodging, Dexterity saves are rolled twice and the better kept: 0.6 squared.
assert.equal(odds().b, 0.36);
// On the menu, beside each target's health.
state.order = state.combatants.map((one) => one.id);
state.turn = 0;
const { rulesetMenu } = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const offered = rulesetMenu(definition, state, "mage").find((option) => option.id === "hold");
assert.equal(offered?.saveChances?.a, 0.6, JSON.stringify(offered));
// Nothing for an attack, which shows its odds to hit instead.
assert.deepEqual(rulesetSaveFailChances(definition, state, "mage", claw.id, ["a"]), {});

console.log(
  "Save odds: a target's chance to fail, rolled twice where it says so, nought with a Legendary Resistance left.",
);
