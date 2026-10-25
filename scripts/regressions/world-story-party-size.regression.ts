/**
 * Parties beyond six, and companions who never fight (Capability API 1.360).
 *
 *   - A story fight's variant may be for a party above six, or open-ended (`{ "min": 7 }`: any party of
 *     seven or more); two variants still never hold one size.
 *   - A story condition may test the party's size (`{ "partySize": { "is", "value" } }`), in events,
 *     directions and anywhere else conditions go; it holds only when the size is known.
 *   - A people file's companion may be `noncombatant`: they travel with the party but are not counted in
 *     its size, and the Game Master is told they never fight. The fight's start leaves them off the board.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  experienceCompanionsPromptText,
  experiencePeopleMinor,
  parseWorldKit,
  readExperiencePeople,
  storyCapabilityMinor,
  storyConditionsHold,
  storyFightForParty,
  storyPartyOf,
  storyTurn,
  storyTurnPromptText,
  worldCast,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";
import { gamePartySize } from "../../packages/server/src/services/game/experience-companions.service.js";
import { buildPartyNpcId } from "../../packages/server/src/services/generation/game-party-utils.js";

const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
const kit = parsedKit.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const brief = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A valley held at harvest",
  places: [{ name: "Thrushwick", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Tamsin", "Wren", "Edda", "Fenn"],
    family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
  })),
});
assert.ok(brief.ok, JSON.stringify(brief));
const stored = { seed: 7, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief: brief.brief };
const game: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };

const scarecrows = (count: number) => [{ creature: "creatures/scarecrow", count }];
const granary = {
  id: "granary",
  name: "The Granary",
  creatures: scarecrows(2),
  variants: [
    { party: { min: 3, max: 6 }, creatures: scarecrows(4) },
    { party: { min: 7, max: 9 }, creatures: scarecrows(7) },
    { party: { min: 10 }, creatures: scarecrows(10) },
  ],
};
const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [{ id: "warned", kind: "bool", initial: false }],
  events: [
    {
      id: "crowd",
      when: { on: "turn", turn: 1 },
      if: [{ partySize: { is: ">=", value: 7 } }],
      do: [{ set: "warned", value: true }],
    },
  ],
  directions: [
    { id: "reeve", text: "The reeve counts heads at the gate.", if: [{ partySize: { is: ">", value: 4 } }] },
  ],
  cutscenes: [],
  fights: [granary],
  endings: [],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 360);
const small = checkStoryScript(game, {
  ...input,
  events: [],
  directions: [],
  fights: [{ ...granary, variants: [granary.variants[0]!] }],
});
assert.ok(small.ok, JSON.stringify(small));
assert.equal(storyCapabilityMinor(small.story), 356, "a party of six at most is 1.356 still");

// ── Refused: sizes held twice, an open range under another ──
const bad = (variants: unknown[], issue: RegExp) => {
  const result = checkStoryScript(game, { ...input, fights: [{ ...granary, variants }] as never });
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
bad(
  [
    { party: { min: 8 }, creatures: scarecrows(1) },
    { party: 12, creatures: scarecrows(1) },
  ],
  /a party of 12/,
);
bad([{ party: { min: 40 }, creatures: scarecrows(1) }], /32|less than or equal/i);

// ── Which is fought ──
const fight = story.fights[0]!;
assert.equal(storyFightForParty(fight, 2), fight);
assert.equal(storyFightForParty(fight, 6).creatures[0]!.count, 4);
assert.equal(storyFightForParty(fight, 8).creatures[0]!.count, 7);
assert.equal(storyFightForParty(fight, 10).creatures[0]!.count, 10);
assert.equal(storyFightForParty(fight, 57).creatures[0]!.count, 10, "an open range holds any larger party");
assert.equal(storyFightForParty(fight, 57).forParty, 57);

// ── The party's size as a condition ──
const sized = (size?: number) => storyPartyOf(game, story, [], size);
const atLeastSeven = [{ partySize: { is: ">=" as const, value: 7 } }];
assert.equal(storyConditionsHold(atLeastSeven, {}, sized(7)), true);
assert.equal(storyConditionsHold(atLeastSeven, {}, sized(6)), false);
assert.equal(storyConditionsHold(atLeastSeven, {}, sized()), false, "not known, not held");
assert.equal(storyConditionsHold(atLeastSeven, {}), false);
assert.equal(
  storyConditionsHold(
    [{ any: [{ partySize: { is: "<", value: 2 } }, { flag: "warned", is: "=", value: true }] }],
    { warned: false },
    sized(1),
  ),
  true,
  "in an either-or too",
);
const turnOf = (partySize?: number) =>
  storyTurn(story, {
    game,
    replies: [],
    repliesBefore: 0,
    latest: null,
    told: [],
    day: 0,
    fight: null,
    ...(partySize !== undefined ? { partySize } : {}),
  });
assert.equal(turnOf(8).state.flags.warned, true, "an event for a large party trips");
assert.equal(turnOf(3).state.flags.warned, false);
assert.equal(turnOf().state.flags.warned, false);
assert.match(storyTurnPromptText(story, turnOf(5)), /The reeve counts heads/);
assert.doesNotMatch(storyTurnPromptText(story, turnOf(3)), /The reeve counts heads/);

// ── Companions who never fight ──
const thrushwick = game.world.places.find((place) => place.name === "Thrushwick")!;
const [liesl, healer] = worldCast(game, thrushwick.id).filter((person) => person.named);
assert.ok(liesl && healer);
const level = (at: number) => ({
  at,
  build: { abilities: {}, skills: {}, saves: {}, bonuses: {}, fields: { level: at }, lists: {} },
});
const sheets = { "5e-2014": { level: ["level"], builds: [level(1)] } };
const people = readExperiencePeople(
  JSON.stringify({
    peopleVersion: 1,
    people: [
      { person: liesl.id, companion: { role: "Keeps the ledger", noncombatant: true, sheets } },
      { person: healer.id, companion: { role: "Healing", sheets } },
    ],
  }),
);
assert.ok(people.ok, JSON.stringify(people));
assert.equal(experiencePeopleMinor(people.people), 360);
const told = experienceCompanionsPromptText(game, people.people, [liesl.name]);
assert.ok(told.includes(`${liesl.name} (travelling with the party): Keeps the ledger (never fights`), told);
assert.ok(!told.includes(`${healer.name} (at Thrushwick): Healing (never`), told);
assert.ok(
  !readExperiencePeople(
    JSON.stringify({ peopleVersion: 1, people: [{ person: liesl.id, companion: { noncombatant: false, sheets } }] }),
  ).ok,
  "noncombatant is true or left out",
);
const meta = { gamePartyCharacterIds: ["c1", buildPartyNpcId(liesl.name), buildPartyNpcId(healer.name)] };
assert.equal(gamePartySize(meta), 4);
assert.equal(gamePartySize(meta, new Set([buildPartyNpcId(liesl.name)])), 3, "she is not counted");

console.log("Party size: parties beyond six, a size condition, and companions who never fight.");
