/**
 * Fight variants by party size (Capability API 1.356).
 *
 *   - A story fight may have variants: the first whose `party` (a size, or `{ min, max }`) holds the
 *     party's size is fought with its own creatures, board and note; any other size fights the fight.
 *   - A party is the player's character and every companion travelling with it.
 *   - The Game Master is told the variant when the story starts it, the blueprint prompt names it, and
 *     the turn after its recap names it again.
 *   - Two variants for one size, or a variant on a board not painted, refuse the script whole.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  applyStoryTags,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  storyCapabilityMinor,
  storyFightForParty,
  storyFightIn,
  storyTurn,
  type GameWorld,
  type StoryScriptInput,
  type StoryTurnWorld,
} from "../../packages/shared/src/index.js";
import { storyFightPromptText } from "../../packages/server/src/services/game/story-fight.service.js";
import { gamePartySize } from "../../packages/server/src/services/game/experience-companions.service.js";

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const kit = parsed.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const checked = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A valley held at harvest",
  places: [
    { name: "Thrushwick", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] },
    { name: "Sallowford", layer: settlementLayer.id, size: kit.sizes[0]!.id, tags: [] },
  ],
  groups: [{ name: "The Reeve's Men", kind: kit.groupKinds[0]!.id, seat: "Thrushwick" }],
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Tamsin", "Wren", "Edda", "Fenn"],
    family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
  })),
});
assert.ok(checked.ok, JSON.stringify(checked));
const stored = {
  seed: 7,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: checked.brief,
};
const base: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };
const thrushwick = base.world.places.find((place) => place.name === "Thrushwick")!;
const game = {
  ...base,
  edits: {
    battlefields: [
      { id: "b1", name: "The Granary", place: thrushwick.id, size: "small", scene: "plains", rows: ["ppp", "p#p"] },
    ],
  },
} as unknown as GameWorld;

const granary = {
  id: "granary",
  name: "The Granary",
  creatures: [{ creature: "creatures/scarecrow", count: 2 }],
  battlefield: "b1",
  note: "The jars break when hit.",
  variants: [
    { party: { min: 3, max: 4 }, creatures: [{ creature: "creatures/scarecrow", count: 4 }] },
    {
      party: { min: 5, max: 6 },
      creatures: [
        { creature: "creatures/scarecrow", count: 5 },
        { creature: "The Owed", name: "The Owed" },
      ],
      battlefield: "b2",
      note: "The Owed wakes in the loft.",
    },
  ],
};
const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  events: [{ id: "ambush", when: { on: "turn", turn: 1 }, do: [{ fight: "granary" }] }],
  cutscenes: [],
  fights: [granary],
  endings: [],
};
const game2 = {
  ...game,
  edits: {
    battlefields: [
      ...(game.edits as { battlefields: unknown[] }).battlefields,
      { id: "b2", name: "The Loft", place: thrushwick.id, size: "small", scene: "plains", rows: ["ppp", "ppp"] },
    ],
  },
} as unknown as GameWorld;
const read = checkStoryScript(game2, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 356);

// ── Refused whole: a size covered twice, or a board not painted ──
const bad = (fight: object, issue: RegExp) => {
  const result = checkStoryScript(game2, { ...input, fights: [{ ...granary, ...fight }] });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
bad(
  { variants: [granary.variants[0], { party: 4, creatures: granary.creatures }] },
  /two variants are for a party of 4/,
);
bad({ variants: [{ ...granary.variants[1], battlefield: "b9" }] }, /no battlefield "b9"/);
assert.equal(checkStoryScript(game, input).ok, false, "b2 is not painted in the plain world");
assert.equal(
  checkStoryScript(game2, {
    ...input,
    fights: [{ ...granary, variants: [{ party: { min: 4, max: 2 }, creatures: granary.creatures }] }],
  }).ok,
  false,
  "a range's min is not above its max",
);
assert.equal(
  checkStoryScript(game2, {
    ...input,
    fights: [{ ...granary, variants: [{ party: 33, creatures: granary.creatures }] }],
  }).ok,
  false,
  "a party is named up to 32 (1.360)",
);

// ── Which is fought ──
const fight = story.fights[0]!;
assert.equal(storyFightForParty(fight, 1), fight, "a party of one fights the fight");
assert.equal(storyFightForParty(fight, 2), fight, "no variant for two");
assert.equal(storyFightForParty(fight, undefined), fight);
const four = storyFightForParty(fight, 4);
assert.equal(four.forParty, 4);
assert.equal(four.creatures[0]!.count, 4);
assert.equal(four.battlefield, "b1", "a variant without a board keeps the fight's");
assert.equal(four.note, "The jars break when hit.");
const six = storyFightForParty(fight, 6);
assert.equal(six.battlefield, "b2");
assert.equal(six.note, "The Owed wakes in the loft.");
assert.equal(six.creatures.length, 2);

// The party: the player and every one travelling with it, counted once.
assert.equal(gamePartySize({}), 1);
assert.equal(gamePartySize({ gamePartyCharacterIds: ["c1", "npc:wren", "c1", 4] }), 3);

// ── Told: the start, the blueprint, the recap ──
const turnOf = (replies: string[], extra: Partial<StoryTurnWorld> = {}) =>
  storyTurn(story, {
    game: game2,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    ...extra,
  });
const solo = turnOf([]);
assert.match(solo.tells.join("\n"), /The story starts the fight "The Granary" now \(The jars break/);
assert.doesNotMatch(solo.tells.join("\n"), /as set for a party/);
const five = turnOf([], { partySize: 5 });
assert.match(
  five.tells.join("\n"),
  /The story starts the fight "The Granary" \(as set for a party of 5\) now \(The Owed wakes in the loft\.\)\. .*5 creatures\/scarecrow, 1 The Owed/,
);
const started = `${five.prepend}They come.`;
assert.equal(storyFightIn(story, started)?.id, "granary");

assert.match(
  storyFightPromptText(storyFightForParty(fight, 5), [{ name: "The Owed", creature: "The Owed" }]),
  /^This fight is set by the story: "The Granary", as set for a party of 5\. The Owed wakes in the loft\./,
);
assert.match(storyFightPromptText(fight, []), /^This fight is set by the story: "The Granary"\. The jars/);

const recap = turnOf([started], { partySize: 5, fight: "victory" });
assert.match(
  recap.tells.join("\n"),
  /The fight that just ended was the story's "The Granary", as set for a party of 5: 5 creatures\/scarecrow, 1 The Owed\./,
);
const soloRecap = turnOf([`${solo.prepend}They come.`], { fight: "victory" });
assert.doesNotMatch(soloRecap.tells.join("\n"), /fight that just ended/, "the fight as written is not named again");

// A fight the Game Master's own trip starts is in its reply: the next turn (its fight fought) does not
// tell it as starting again, and its recap still names the variant.
const byGm = checkStoryScript(game2, {
  ...input,
  events: [{ id: "go", when: { on: "gm" }, gm: true, do: [{ fight: "granary" }] }],
});
assert.ok(byGm.ok, JSON.stringify(byGm));
const gmTurn = (replies: string[], fought: StoryTurnWorld["fight"]) =>
  storyTurn(byGm.story, {
    game: game2,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: fought,
    partySize: 5,
  });
const opened = gmTurn([], null);
const gmReply = applyStoryTags('[story: event="go"] They come.', byGm.story, game2, opened.state, opened.tripped);
assert.match(gmReply, /fight="granary"/);
const afterGm = gmTurn([gmReply], "victory").tells.join("\n");
assert.doesNotMatch(afterGm, /starts the fight/, "not told as starting again");
assert.match(afterGm, /The fight that just ended was the story's "The Granary", as set for a party of 5/);

console.log("world-story-fight-variants: ok");
