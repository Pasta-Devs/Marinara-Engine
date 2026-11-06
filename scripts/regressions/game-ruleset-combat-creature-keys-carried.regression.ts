/**
 * A catalog creature's actions reach the fight whole: the creature action keys of Capability API
 * 1.673 to 1.685 are carried onto its stat block (`oncePerTarget` once was not), and from there onto
 * the action the fight offers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
} from "../../packages/shared/src/index.js";

assert.ok(supportedCapabilityApi.minor >= 685);
const doc = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)), "utf8"),
) as Record<string, any>;
doc.sheet.live.conditions.push({ id: "ethereal", label: "Ethereal" });
doc.combat.conditions.push({ condition: "ethereal", effects: [], endable: { budget: "action" } });
const carried = {
  presence: {
    id: "presence",
    name: "Frightful Presence",
    budget: "action",
    autoHit: true,
    save: {
      save: "wis_save",
      difficulty: 16,
      onSuccess: "negates",
      failedBy: { atLeast: 5, applies: [{ condition: "paralyzed", duration: { rounds: 1 } }] },
    },
    applies: [{ condition: "frightened", duration: { rounds: 10 } }],
    oncePerTarget: { whenSaved: true, whenEnds: true, until: "long" },
  },
  whip: {
    id: "whip",
    name: "Whip",
    budget: "action",
    toHit: 14,
    damage: { dice: "2d6", flat: 8, type: "slashing" },
    save: { save: "str_save", difficulty: 20, onSuccess: "negates" },
    pull: 25,
  },
  bite: {
    id: "bite",
    name: "Bite",
    budget: "action",
    toHit: 5,
    damage: { dice: "1d8", flat: 3, type: "piercing" },
    onFell: { stabilizes: true, applies: [{ condition: "poisoned", duration: { rounds: 600 } }] },
  },
  slaying: {
    id: "slaying",
    name: "Slaying Longbow",
    budget: "action",
    toHit: 13,
    damage: { dice: "2d8", flat: 6, type: "piercing" },
    save: { save: "con_save", difficulty: 15, onSuccess: "negates" },
    slaysOnFailedSave: true,
    slaysHealthAtMost: 190,
  },
  glare: {
    id: "glare",
    name: "Death Glare",
    budget: "action",
    autoHit: true,
    save: { save: "wis_save", difficulty: 11, onSuccess: "negates" },
    dropsOnFailedSave: true,
  },
  etherealness: {
    id: "etherealness",
    name: "Etherealness",
    budget: "action",
    self: true,
    applies: [{ condition: "ethereal", duration: "until-dispelled" }],
    dismisses: { while: "ethereal", turns: true },
  },
};
const entry = doc.catalogs.find((one: { id: string }) => one.id === "creatures").entries[0];
entry.creature.actions.push(...Object.values(carried));
const result = parseRulesetDefinition(doc);
assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
const definition = result.definition;
const creature = definition
  .catalogs!.find((one) => one.id === "creatures")!
  .entries!.find((one) => one.id === entry.id)!.creature!;
const block = rulesetStatBlockFromCreature(definition, creature)!;
const on = (id: string) => block.actions.find((one) => one.id === id)! as unknown as Record<string, unknown>;

assert.deepEqual(on("presence").oncePerTarget, carried.presence.oncePerTarget, "oncePerTarget");
assert.deepEqual((on("presence").save as Record<string, unknown>).failedBy, carried.presence.save.failedBy);
assert.equal(on("whip").pull, 25);
assert.deepEqual(on("bite").onFell, carried.bite.onFell);
assert.equal(on("slaying").slaysHealthAtMost, 190);
assert.equal(on("glare").dropsOnFailedSave, true);
assert.deepEqual(on("etherealness").dismisses, carried.etherealness.dismisses);

// And onto what the fight offers.
const state = createRulesetEncounter({
  definition,
  seed: 1,
  roller: () => 10,
  combatants: [
    { id: "it", name: "It", side: "enemy", block },
    { id: "hero", name: "Hero", side: "party", block: { ...block, actions: [] } },
  ],
});
const fought = (id: string) =>
  rulesetCombatant(state, "it")!.actions.find((one) => one.id === id)! as unknown as Record<string, unknown>;
assert.deepEqual(fought("presence").sparedAfter, carried.presence.oncePerTarget);
assert.equal(fought("slaying").slaysHealthAtMost, 190);
assert.deepEqual(fought("etherealness").dismisses, carried.etherealness.dismisses);

console.log("Creature keys carried: 1.673 to 1.685 reach a catalog creature's block and its fight.");
