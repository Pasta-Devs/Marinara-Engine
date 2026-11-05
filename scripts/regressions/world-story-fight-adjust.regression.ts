/**
 * A story fight's creatures adjusted for that fight (Capability API 1.363).
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
  storyFightAdjustAt,
  storyFightAdjustText,
  storyFightForParty,
  storyFightRoster,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";
import {
  storyFightAdjustsFor,
  storyFightOpponents,
  storyFightPromptText,
} from "../../packages/server/src/services/game/story-fight.service.js";

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
assert.equal(storyCapabilityMinor(read.story), 363);
assert.ok(
  !checkStoryScript(game, {
    ...input,
    fights: [{ id: "x", name: "X", creatures: [{ creature: "Wolf", adjust: {} }] }],
  }).ok,
  "an adjust changes something",
);
const fight = read.story.fights[0]!;
// The roster reads a bestiary id by a label; the id itself stands in for its name here.
const solo = storyFightRoster(storyFightForParty(fight, 1), (ref) => ref).opponents;
assert.deepEqual(solo, [{ name: "Basilisk", creature: "creatures/basilisk", adjust: { maxHp: 40 } }]);
const six = storyFightRoster(storyFightForParty(fight, 6), (ref) => ref).opponents;
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

// ── Whom an action calls, from a party level up (1.371): the Shelves Lean calls a wraith from level 8 ──
{
  const leveled = checkStoryScript(game, {
    ...input,
    fights: [
      {
        id: "shelves",
        name: "The Shelves",
        creatures: [
          {
            creature: "creatures/basilisk",
            name: "Owed",
            adjust: {
              maxHp: 90,
              levels: [
                { from: 5, calls: [{ action: "shelves_lean", creature: "creatures/ghoul" }] },
                { from: 8, legendaryResistance: 1, calls: [{ action: "shelves_lean", creature: "creatures/wraith" }] },
              ],
            },
          },
        ],
      },
    ],
  });
  assert.ok(leveled.ok, JSON.stringify(leveled));
  assert.equal(storyCapabilityMinor(leveled.story), 371);
  const adjust = leveled.story.fights[0]!.creatures[0]!.adjust!;
  assert.deepEqual(storyFightAdjustAt(adjust, 3), { maxHp: 90 });
  assert.deepEqual(storyFightAdjustAt(adjust, null), { maxHp: 90 }, "a level not known: the creature's own");
  assert.deepEqual(storyFightAdjustAt(adjust, 6), {
    maxHp: 90,
    calls: [{ action: "shelves_lean", creature: "creatures/ghoul" }],
  });
  assert.deepEqual(storyFightAdjustAt(adjust, 9), {
    maxHp: 90,
    legendaryResistance: 1,
    calls: [{ action: "shelves_lean", creature: "creatures/wraith" }],
  });
  assert.match(
    storyFightAdjustText(adjust),
    /90 HP; from party level 5: shelves_lean calls creatures\/ghoul; from party level 8: Legendary Resistance 1, shelves_lean calls creatures\/wraith/,
  );
  // Refused: levels out of order, a level that changes nothing.
  const refused = (levels: unknown) =>
    checkStoryScript(game, {
      ...input,
      fights: [
        {
          id: "shelves",
          name: "The Shelves",
          creatures: [{ creature: "creatures/basilisk", adjust: { levels } as never }],
        },
      ],
    }).ok;
  assert.equal(
    refused([
      { from: 8, maxHp: 5 },
      { from: 5, maxHp: 4 },
    ]),
    false,
  );
  assert.equal(refused([{ from: 8 }]), false);

  // In the fight: the action's call is the adjust's creature, by the action's id or its name.
  const [owedEntry, calledEntry] = bestiaryCatalog.entries!;
  const lean = {
    id: "shelves_lean",
    name: "Shelves Lean",
    budget: "action",
    calls: { creature: `${bestiaryCatalog.id}/${owedEntry!.id}`, count: { flat: 1 } },
  };
  const shelves = {
    ...owedEntry!,
    creature: { ...owedEntry!.creature!, actions: [...owedEntry!.creature!.actions, lean] },
  };
  const fightWith = (calls?: Array<{ action: string; creature: string }>) => {
    const state = createRulesetEncounter({
      definition,
      seed: 3,
      bestiary: { [bestiaryCatalog.id]: [shelves, ...bestiaryCatalog.entries!.slice(1)] } as typeof bestiary,
      combatants: [
        {
          id: "o",
          name: "Owed",
          side: "enemy",
          creature: { catalogId: bestiaryCatalog.id, entryId: owedEntry!.id },
          ...(calls ? { adjust: { calls } } : {}),
        },
      ],
    });
    return rulesetCombatant(state, "o")!.actions.find((one) => one.id === "shelves_lean")?.calls;
  };
  assert.equal(fightWith()?.creature.entryId, owedEntry!.id);
  const wraith = `${bestiaryCatalog.id}/${calledEntry!.id}`;
  assert.equal(fightWith([{ action: "Shelves Lean", creature: wraith }])?.creature.entryId, calledEntry!.id);
  assert.equal(fightWith([{ action: "shelves_lean", creature: wraith }])?.name, calledEntry!.label);
  assert.equal(fightWith([{ action: "other", creature: wraith }])?.creature.entryId, owedEntry!.id);
}

// ── Named as the fight names its enemies ──
// An opponent named only by its bestiary id is the bestiary's label in the fight, and its adjustment is
// found by that name (as `latestStoryFightAdjusts` reads it), never by the raw id.
const unnamed = {
  ...fight,
  creatures: [{ creature: `${bestiaryCatalog.id}/${entryId}`, count: 1, adjust: { maxHp: 40 } }],
  variants: [],
};
const { opponents: labelled } = await storyFightOpponents(unnamed, { definition, packageId: null });
assert.deepEqual(
  labelled.map((each) => [each.name, each.adjust]),
  [[bestiaryCatalog.entries![0]!.label, { maxHp: 40 }]],
);

// Opponents named alike take their adjustments in roster order, and one the fight does not adjust takes none.
const alike = new Map([["warden", [{ maxHp: 30 }, null, { maxHp: 50 }]]]);
assert.deepEqual(
  storyFightAdjustsFor([{ name: "Warden" }, { name: "Wolf" }, { name: "warden " }, { name: "Warden" }], alike),
  [{ maxHp: 30 }, null, null, { maxHp: 50 }],
);

console.log(
  "Story fight adjust: a creature's Legendary Resistance, health and calls set for one fight, by party level.",
);
