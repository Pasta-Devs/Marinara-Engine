/**
 * A story fight's creatures adjusted for that fight (Capability API 1.371).
 *
 *   - A fight's (or a variant's) creature entry may carry `adjust`: its Legendary Resistance and its health
 *     (`maxHp`), in place of its stat block's, so a boss scales by party size without a creature of its own.
 *   - The roster carries it, the Game Master is told it, and the fight builds the creature with it (a fixed
 *     health, its dice no longer thrown; Legendary Resistance 0 takes it away).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createRulesetEncounter,
  parseRulesetDefinition,
  parseWorldKit,
  rulesetCombatant,
  rulesetCombatHealth,
  storyCapabilityMinor,
  storyFightForParty,
  storyFightRoster,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";
import { storyFightPromptText } from "../../packages/server/src/services/game/story-fight.service.js";

const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
const kit = parsedKit.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const brief = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A valley held at harvest",
  places: [{ name: "Thrushwick", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
});
assert.ok(brief.ok, JSON.stringify(brief));
const stored = { seed: 7, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief: brief.brief };
const game: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  events: [],
  cutscenes: [],
  fights: [
    {
      id: "basilisk",
      name: "The Basilisk",
      creatures: [{ creature: "creatures/basilisk", name: "Basilisk", adjust: { maxHp: 40 } }],
      variants: [
        {
          party: { min: 5 },
          creatures: [{ creature: "creatures/basilisk", name: "Basilisk", adjust: { legendaryResistance: 2 } }],
        },
      ],
    },
  ],
  endings: [],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
assert.equal(storyCapabilityMinor(read.story), 371);
assert.ok(
  !checkStoryScript(game, {
    ...input,
    fights: [{ id: "x", name: "X", creatures: [{ creature: "Wolf", adjust: {} }] }],
  }).ok,
  "an adjust changes something",
);
const fight = read.story.fights[0]!;
const solo = storyFightRoster(storyFightForParty(fight, 1));
assert.deepEqual(solo, [{ name: "Basilisk", creature: "creatures/basilisk", adjust: { maxHp: 40 } }]);
const six = storyFightRoster(storyFightForParty(fight, 6));
assert.deepEqual(six[0]!.adjust, { legendaryResistance: 2 });
assert.match(storyFightPromptText(fight, solo), /- Basilisk \(creature: creatures\/basilisk; in this fight: 40 HP\)/);
assert.match(storyFightPromptText(storyFightForParty(fight, 6), six), /in this fight: Legendary Resistance 2\)/);

// ── Built with it ──
const parsed = parseRulesetDefinition(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  ),
);
assert.ok(parsed.ok);
const definition = parsed.definition;
const bestiaryCatalog = definition.catalogs!.find((catalog) => catalog.holds === "creatures")!;
const bestiary = { [bestiaryCatalog.id]: bestiaryCatalog.entries! };
const entryId = bestiaryCatalog.entries![0]!.id;
const build = (adjust?: { legendaryResistance?: number; health?: number }) => {
  const state = createRulesetEncounter({
    definition,
    seed: 3,
    bestiary,
    combatants: [
      {
        id: "b",
        name: "Basilisk",
        side: "enemy",
        creature: { catalogId: bestiaryCatalog.id, entryId },
        ...(adjust ? { adjust } : {}),
      },
    ],
  });
  const combatant = rulesetCombatant(state, "b")!;
  return { combatant, max: rulesetCombatHealth(definition, definition.combat!, combatant).max };
};
const plain = build();
const adjusted = build({ legendaryResistance: 2, health: 40 });
assert.equal(adjusted.max, 40);
assert.equal(adjusted.combatant.block?.legendaryResistance, 2);
assert.equal(plain.combatant.block?.legendaryResistance, undefined);
assert.notEqual(plain.max, 40);
assert.equal(build({ legendaryResistance: 0 }).combatant.block?.legendaryResistance, undefined);
// The bestiary's own entry is untouched.
assert.equal(bestiaryCatalog.entries![0]!.creature?.legendaryResistance, undefined);

console.log("Story fight adjust: a creature's Legendary Resistance and health set for one fight.");
