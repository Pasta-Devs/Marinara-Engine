/**
 * Story clocks and story actions (Capability API 1.342 and 1.343).
 *
 *   - A number flag can be a clock: the player sees it fill, a hidden one only once shown, and the Game
 *     Master is told once when it fills, by its own tag or a trip.
 *   - An event can give an item (a ruleset's by id, or one by name), start one of the script's fights,
 *     move the party, or end the game. Each is written into the reply as the tag its own pipeline
 *     answers; an id the ruleset does not offer is refused with the reason; nothing trips after an ending.
 *   - A fight's opponents are the story's, by the bestiary's names, and a script naming what is not there
 *     is refused whole.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  applyStoryTags,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  readStoryLedger,
  storyClocks,
  storyEndingOf,
  storyFightIn,
  storyFightRoster,
  storyState,
  storyTurn,
  storyTurnPromptText,
  type GameWorld,
  type StoryScriptInput,
  type StoryTurnWorld,
} from "../../packages/shared/src/index.js";
import {
  storyFightBlueprintEnemies,
  storyFightPromptText,
} from "../../packages/server/src/services/game/story-fight.service.js";

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
const sallowford = base.world.places.find((place) => place.name === "Sallowford")!;
const game = {
  ...base,
  edits: {
    battlefields: [
      { id: "b1", name: "The Granary", place: thrushwick.id, size: "small", scene: "plains", rows: ["ppp", "p#p"] },
    ],
  },
} as unknown as GameWorld;

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [
    {
      id: "reeve",
      kind: "number",
      initial: 0,
      gm: true,
      clock: { title: "The Reeve's patience", segments: 4, full: "The Reeve sends his men for the party." },
    },
    {
      id: "harvest",
      kind: "number",
      initial: 0,
      clock: { title: "The last harvest", segments: 6, full: "The year turns.", hidden: true },
    },
  ],
  events: [
    {
      id: "gift",
      when: { on: "start" },
      do: [
        { give: { item: "gear/rope", count: 2 } },
        { give: { item: "A corn-dolly", summary: "A doll of plaited straw" } },
        { give: { item: "gear/unknown-thing" } },
        { show: "harvest" },
      ],
    },
    { id: "pressed", when: { on: "turn", turn: 2 }, do: [{ add: "reeve", amount: 4 }] },
    { id: "ambush", when: { on: "turn", turn: 3 }, do: [{ fight: "granary" }] },
    { id: "away", when: { on: "turn", turn: 4 }, do: [{ move: sallowford.id }] },
    { id: "there", when: { on: "arrive", place: sallowford.id }, do: [{ tell: "Sallowford is quiet." }] },
    { id: "end", when: { on: "turn", turn: 5 }, do: [{ ending: "kept" }] },
    { id: "after", when: { on: "turn", turn: 5 }, do: [{ tell: "Never told." }] },
    { id: "spare", when: { on: "gm" }, gm: true, do: [{ give: { item: "gear/rope" } }, { fight: "granary" }] },
  ],
  cutscenes: [{ id: "last", kind: "pages", pages: [{ text: "The bells ring the year out." }] }],
  fights: [
    {
      id: "granary",
      name: "The Granary",
      creatures: [
        { creature: "creatures/scarecrow", count: 2 },
        { creature: "The Owed", name: "The Owed" },
      ],
      battlefield: "b1",
    },
  ],
  endings: [{ id: "kept", title: "The Year Kept", cutscene: "last", epilogue: "The valley stays held." }],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;

// ── Refused whole: what the script names must be there ──
const bad = (patch: Partial<StoryScriptInput>, issue: RegExp) => {
  const result = checkStoryScript(game, { ...input, ...patch });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
bad({ fights: [{ ...input.fights![0]!, battlefield: "b9" }] }, /no battlefield "b9"/);
bad({ events: [{ id: "x", when: { on: "start" }, do: [{ fight: "nowhere" }] }] }, /no fight "nowhere"/);
bad({ events: [{ id: "x", when: { on: "start" }, do: [{ ending: "nowhere" }] }] }, /no ending "nowhere"/);
bad({ events: [{ id: "x", when: { on: "start" }, do: [{ move: "nowhere" }] }] }, /no place "nowhere"/);
bad(
  { flags: [{ id: "b", kind: "bool", initial: false, clock: { title: "B", segments: 3, full: "x" } }] },
  /only a number flag is a clock/,
);
bad({ endings: [{ id: "kept", title: "T", cutscene: "missing", epilogue: "E" }] }, /no cutscene "missing"/);

const items: Record<string, string> = { "gear/rope": "Hempen Rope" };
const turnOf = (replies: string[], extra: Partial<StoryTurnWorld> = {}) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    item: (ref) => items[ref],
    ...extra,
  });
/** A turn's reply as saved: its prepend, then the Game Master's words. */
const reply = (turn: ReturnType<typeof turnOf>, words = "The Game Master speaks.") => `${turn.prepend}${words}`;

// ── Turn 1: the gifts, by id and by name; an id the ruleset lacks is refused ──
const first = turnOf([]);
assert.deepEqual(first.tripped, ["gift"]);
assert.match(first.prepend, /\[inventory: action="add" item="Hempen Rope" count="2"\]/);
assert.match(
  first.prepend,
  /\[inventory: action="add" item="A corn-dolly" count="1" summary="A doll of plaited straw"\]/,
);
assert.match(
  first.prepend,
  /\[story: event="gift" give="gear\/unknown-thing" result="refused" reason="unknown-item"\]/,
);
assert.doesNotMatch(first.prepend, /item="gear\/unknown-thing"/);
// A refused give is never read as a trip.
assert.equal(readStoryLedger([first.prepend]).filter((entry) => entry.event === "gift").length, 1);
const r1 = reply(first);

// The clocks: the hidden one is shown by the trip; both empty.
let clocks = storyClocks(story, first.state);
assert.deepEqual(
  clocks.map((clock) => [clock.flag, clock.filled, clock.segments, clock.full]),
  [
    ["reeve", 0, 4, false],
    ["harvest", 0, 6, false],
  ],
);
assert.equal(storyClocks(story, storyState(story, [])).length, 1, "a hidden clock waits to be shown");

// ── Turn 2: a trip fills the Reeve's clock, and the Game Master is told once ──
const second = turnOf([r1]);
assert.deepEqual(second.tripped, ["pressed"]);
assert.deepEqual(
  second.filled.map((each) => each.flag),
  ["reeve"],
);
assert.match(
  storyTurnPromptText(story, second),
  /The clock "The Reeve's patience" has just filled\. Bring this about now: The Reeve sends his men/,
);
assert.match(storyTurnPromptText(story, second), /The Reeve's patience 4\/4/);
clocks = storyClocks(story, second.state);
assert.equal(clocks.find((clock) => clock.flag === "reeve")!.full, true);
const r2 = reply(second);

// ── Turn 3: the fight starts, with the story's opponents on its board ──
const third = turnOf([r1, r2]);
assert.deepEqual(third.tripped, ["ambush"]);
assert.equal(third.filled.length, 0, "a full clock is told only once");
assert.match(third.prepend, /\[story: event="ambush" fight="granary" by="engine" result="ok"\]/);
assert.match(third.prepend, /\[state: combat\]/);
assert.match(third.tells.join("\n"), /The story starts the fight "The Granary" now/);
const r3 = reply(third);
const fight = storyFightIn(story, r3);
assert.equal(fight?.id, "granary");
assert.equal(storyFightIn(story, r2), null);
const { opponents: roster, refused } = storyFightRoster(fight!, (ref) =>
  ref === "creatures/scarecrow" ? "Scarecrow" : undefined,
);
assert.deepEqual(roster, [
  { name: "Scarecrow 1", creature: "Scarecrow" },
  { name: "Scarecrow 2", creature: "Scarecrow" },
  { name: "The Owed", creature: "The Owed" },
]);
assert.deepEqual(refused, []);
// A creature id the bestiary doesn't have is refused and listed, never fought as a made-up creature.
const missing = storyFightRoster(
  {
    ...fight!,
    creatures: [
      { creature: "monsters/goblin", count: 2 },
      { creature: "creatures/scarecrow", count: 1 },
    ],
  },
  (ref) => (ref === "creatures/scarecrow" ? "Scarecrow" : undefined),
);
assert.deepEqual(missing.opponents, [{ name: "Scarecrow", creature: "Scarecrow" }]);
assert.deepEqual(missing.refused, ["monsters/goblin"]);
// With every creature refused, the fight is still the story's, but its enemies are the writer's to choose.
assert.match(storyFightPromptText(fight!, []), /Choose its enemies yourself\.$/u);
assert.doesNotMatch(storyFightPromptText(fight!, []), /exactly these/u);
// Without a ruleset to read ids, every id is refused.
assert.deepEqual(storyFightRoster({ ...fight!, creatures: [{ creature: "monsters/goblin", count: 1 }] }), {
  opponents: [],
  refused: ["monsters/goblin"],
});
// The blueprint keeps the model's own enemy where it wrote one, copies one where it did not, and never
// keeps an enemy the story did not ask for or a stat block the model proposed instead.
const enemies = storyFightBlueprintEnemies(
  roster,
  [
    { name: "Bandit", creature: "Bandit", hp: 11, proposed: { x: 1 } },
    { name: "The Owed", hp: 90, boss: { phases: 2 } },
  ],
  true,
);
assert.deepEqual(
  enemies.map((enemy) => [enemy.name, enemy.creature, "proposed" in enemy]),
  [
    ["Scarecrow 1", "Scarecrow", false],
    ["Scarecrow 2", "Scarecrow", false],
    ["The Owed", "The Owed", false],
  ],
);
assert.equal(enemies[2]!.hp, 90);

// ── Turn 4: the party is moved, and an arrival the move brings trips this turn ──
const fourth = turnOf([r1, r2, r3]);
assert.deepEqual(fourth.tripped, ["away", "there"]);
assert.match(fourth.prepend, new RegExp(`\\[place: name="${sallowford.name}"\\]`));
assert.match(fourth.tells.join("\n"), /taken the party to Sallowford/);
const r4 = reply(fourth);

// ── Turn 5: the ending, its scene shown; nothing trips after it ──
const fifth = turnOf([r1, r2, r3, r4]);
assert.deepEqual(fifth.tripped, ["end"]);
assert.match(fifth.prepend, /ending="kept"/);
assert.match(fifth.prepend, /The bells ring the year out\./);
assert.match(fifth.tells.join("\n"), /The story ends here with "The Year Kept"/);
assert.equal(fifth.state.ended, "kept");
const r5 = reply(fifth);
assert.equal(storyState(story, readStoryLedger([r1, r2, r3, r4, r5])).ended, "kept");
assert.deepEqual(storyEndingOf(story, "kept"), {
  id: "kept",
  title: "The Year Kept",
  epilogue: "The valley stays held.",
});
const sixth = turnOf([r1, r2, r3, r4, r5], { repliesBefore: 9 });
assert.deepEqual(sixth.tripped, []);
assert.match(storyTurnPromptText(story, sixth), /The story has ended \("The Year Kept"\)/);

// ── The Game Master's own trip gives and fights the same way; after the ending it is refused ──
const gmAnswered = applyStoryTags('[story: event="spare"]', story, game, third.state, [], (ref) => items[ref]);
assert.match(
  gmAnswered,
  /\[story: event="spare" fight="granary" result="ok"\]\[inventory: action="add" item="Hempen Rope" count="1"\]\[state: combat\]/,
);
const late = applyStoryTags('[story: event="spare"]', story, game, fifth.state, [], (ref) => items[ref]);
assert.match(late, /result="refused" reason="ended"/);

// ── The Game Master filling a clock with its own tag is told on the next turn ──
const gmFill = applyStoryTags('[story: flag="reeve" value="4"]', story, game, first.state);
const told = turnOf([r1, `${gmFill} The Reeve is done waiting.`], { repliesBefore: 7 });
assert.deepEqual(
  told.filled.map((each) => each.flag),
  ["reeve"],
);

console.log("world-story-actions: ok");
