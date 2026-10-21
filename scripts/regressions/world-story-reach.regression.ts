/**
 * How far a story script reaches (Capability API 1.358).
 *
 *   - `any` groups: a condition list holds when any one of a group's conditions does.
 *   - A fight event may name the script's fight it waits on: it trips only when that fight ends so.
 *   - A leave event trips when the party leaves a place (and every place inside it).
 *   - A number flag's `min` and `max` keep every set and add within them, the Game Master's too.
 *   - A scene's page with conditions is shown only while they hold: a group scene for the companions
 *     travelling with the party.
 *   - An action with conditions is done only when they hold as the event reaches it, its earlier actions
 *     done, so one event branches; which were done is recorded, so a Game Master's trip delivers the same.
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
  storyCapabilityMinor,
  storyConditionsHold,
  storyState,
  storyTurn,
  worldCast,
  type GameWorld,
  type StoryScriptInput,
  type StoryTurnWorld,
} from "../../packages/shared/src/index.js";

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
const game: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };
const thrushwick = game.world.places.find((place) => place.name === "Thrushwick")!;
const sallowford = game.world.places.find((place) => place.name === "Sallowford")!;
const [hob, wren] = worldCast(game, thrushwick.id).filter((person) => person.named);
assert.ok(hob && wren);

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [
    { id: "approval", kind: "number", initial: 0, min: -10, max: 10, gm: true },
    { id: "spoke", kind: "number", initial: 0 },
    { id: "won_granary", kind: "bool", initial: false },
    { id: "won_other", kind: "bool", initial: false },
  ],
  events: [
    {
      id: "warmth",
      when: { on: "turn", turn: 1 },
      do: [
        { add: "approval", amount: 12 },
        { tell: "Hob is fond of the party.", if: [{ flag: "approval", is: ">=", value: 5 }] },
        { tell: "Hob is wary of the party.", if: [{ flag: "approval", is: "<", value: 5 }] },
        { cutscene: "camp" },
      ],
    },
    {
      id: "either",
      when: { on: "flags" },
      if: [
        {
          any: [
            { flag: "won_granary", is: "=", value: true },
            { flag: "won_other", is: "=", value: true },
          ],
        },
      ],
      do: [{ tell: "Either fight was won." }],
    },
    {
      id: "granary-won",
      when: { on: "fight", outcome: "victory", fight: "granary" },
      do: [{ set: "won_granary", value: true }],
    },
    { id: "any-won", when: { on: "fight", outcome: "victory" }, repeat: true, do: [{ tell: "A fight was won." }] },
    { id: "into-spoke", when: { on: "arrive", place: sallowford.id }, do: [{ set: "spoke", value: 3 }] },
    { id: "out-of-spoke", when: { on: "leave", place: sallowford.id }, repeat: true, do: [{ set: "spoke", value: 0 }] },
    {
      id: "gift",
      when: { on: "gm" },
      gm: true,
      do: [
        { tell: "The gift is welcome.", if: [{ flag: "approval", is: ">", value: 0 }] },
        { tell: "The gift is refused.", if: [{ flag: "approval", is: "<=", value: 0 }] },
      ],
    },
  ],
  cutscenes: [
    {
      id: "camp",
      kind: "pages",
      pages: [
        { text: "The fire burns low." },
        { speaker: hob.id, text: "Another night.", if: [{ party: hob.id, is: "in" }] },
        { speaker: wren.id, text: "Not for long.", if: [{ party: wren.id, is: "in" }] },
      ],
    },
  ],
  fights: [
    { id: "granary", name: "The Granary", creatures: [{ creature: "Scarecrow", count: 2 }] },
    { id: "orchard", name: "The Orchard", creatures: [{ creature: "Wolf", count: 2 }] },
  ],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 358);

// ── Refused whole ──
const bad = (patch: Partial<StoryScriptInput>, issue: RegExp) => {
  const result = checkStoryScript(game, { ...input, ...patch });
  assert.equal(result.ok, false, JSON.stringify(patch));
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
const flags = input.flags!;
bad({ flags: [{ ...flags[0]!, min: 5, max: 1 }, ...flags.slice(1)] }, /its min is above its max/);
bad({ flags: [{ ...flags[0]!, initial: 20 }, ...flags.slice(1)] }, /first value is outside its min and max/);
bad({ flags: [...flags.slice(0, 2), { ...flags[2]!, max: 1 }, flags[3]!] }, /only a number flag has a min or a max/);
bad(
  { events: [{ id: "x", when: { on: "fight", outcome: "defeat", fight: "nowhere" }, do: [{ tell: "x" }] }] },
  /no fight "nowhere"/,
);
bad({ events: [{ id: "x", when: { on: "leave", place: "nowhere" }, do: [{ tell: "x" }] }] }, /no place "nowhere"/);
bad(
  { events: [{ id: "x", when: { on: "start" }, do: [{ tell: "x", if: [{ flag: "missing", is: "=", value: 1 }] }] }] },
  /Event "x", action 1: no flag "missing"/,
);
bad(
  {
    events: [
      {
        id: "x",
        when: { on: "start" },
        if: [
          {
            any: [
              { flag: "won_granary", is: ">", value: true },
              { flag: "spoke", is: "=", value: 1 },
            ],
          },
        ],
        do: [{ tell: "x" }],
      },
    ],
  },
  /a yes-or-no flag is only = or !=/,
);
bad(
  { cutscenes: [{ id: "camp", kind: "pages", pages: [{ text: "x", if: [{ party: "nobody-1", is: "in" }] }] }] },
  /Cutscene "camp", page 1: no person "nobody-1"/,
);
assert.equal(
  checkStoryScript(game, {
    ...input,
    events: [
      { id: "x", when: { on: "start" }, if: [{ any: [{ flag: "spoke", is: "=", value: 1 }] }], do: [{ tell: "x" }] },
    ],
  }).ok,
  false,
  "an any group has two or more",
);

// ── Any groups ──
assert.ok(storyConditionsHold(story.events[1]!.if, { won_granary: false, won_other: true }));
assert.ok(!storyConditionsHold(story.events[1]!.if, { won_granary: false, won_other: false }));

const turnOf = (replies: string[], extra: Partial<StoryTurnWorld> = {}) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    ...extra,
  });

// ── Turn 1: bounds, a branch, and a scene's pages for who travels ──
const first = turnOf([], { party: [hob.name] });
assert.deepEqual(first.tripped, ["warmth"]);
assert.equal(first.state.flags.approval, 10, "kept within its max");
assert.match(first.prepend, /\[story: event="warmth" set="approval=10" acts="0;1;3" by="engine" result="ok"\]/);
assert.ok(first.tells.includes("Hob is fond of the party."));
assert.ok(!first.tells.includes("Hob is wary of the party."), "the other branch is not done");
assert.match(first.prepend, /Another night\./);
assert.doesNotMatch(first.prepend, /Not for long\./, "Wren does not travel with the party");
assert.match(first.prepend, /The fire burns low\./);
// The fold reads the recorded value, never the script again.
assert.equal(storyState(story, readStoryLedger([first.prepend])).flags.approval, 10);
const r1 = `${first.prepend}The night passes.`;

// ── The Game Master's flag tag is kept within the bounds too ──
const gmTags = applyStoryTags(
  '[story: flag="approval" add="-50"]',
  story,
  game,
  storyState(story, readStoryLedger([r1])),
);
assert.match(gmTags, /set="approval=-10"/);

// ── A Game Master's trip with branches: done as it stood, delivered as done ──
const before = storyState(story, readStoryLedger([r1]));
const tagged = applyStoryTags('Hob takes it. [story: event="gift"]', story, game, before);
assert.match(tagged, /\[story: event="gift" acts="0" result="ok"\]/);
const delivered = turnOf([r1, tagged], { party: [hob.name] });
assert.ok(delivered.tells.includes("The gift is welcome."));
assert.ok(!delivered.tells.includes("The gift is refused."));

// ── A named fight ──
const started = `[story: event="ambush" fight="granary" result="ok"]They come.`;
const won = turnOf([r1, started], { fight: "victory" });
assert.ok(won.tripped.includes("granary-won"), "the granary was won");
assert.ok(won.tripped.includes("any-won"));
assert.ok(won.tripped.includes("either"), "and so either was");
const other = turnOf([r1, `[story: event="ambush" fight="orchard" result="ok"]They come.`], { fight: "victory" });
assert.ok(!other.tripped.includes("granary-won"), "another fight is not the granary");
assert.ok(other.tripped.includes("any-won"));
const unscripted = turnOf([r1, "Wolves attack. [state: combat]"], { fight: "victory" });
assert.ok(!unscripted.tripped.includes("granary-won"), "nor a fight the story did not start");

// ── Leaving a place ──
const there = `[place: name="${sallowford.name}" result="ok"]They arrive.`;
const arrived = turnOf([r1, there]);
assert.ok(arrived.tripped.includes("into-spoke"));
const r3 = `${arrived.prepend}${there}`;
const stay = turnOf([r1, r3, "They rest."]);
assert.ok(!stay.tripped.includes("out-of-spoke"), "still there");
const left = turnOf([r1, r3, `[place: name="${thrushwick.name}" result="ok"]They go home.`]);
assert.ok(left.tripped.includes("out-of-spoke"), "left in the latest reply");
assert.equal(left.state.flags.spoke, 0);
const later = turnOf([
  r1,
  r3,
  `${left.prepend}[place: name="${thrushwick.name}" result="ok"]They go home.`,
  "They sleep.",
]);
assert.ok(!later.tripped.includes("out-of-spoke"), "a leave is a moment: told once");
const walked = turnOf([r1, r3], { told: [{ at: thrushwick.name }] });
assert.ok(walked.tripped.includes("out-of-spoke"), "left on this turn's walk");

console.log("Story reach: either-or conditions, named fights, leaving, bounds, page and action conditions.");
