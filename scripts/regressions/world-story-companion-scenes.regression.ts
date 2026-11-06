/**
 * What people know, and companions' scenes (Capability API 1.348, 1.349).
 *
 *   - A story's `knowledge` is told to the Game Master on a turn its conditions hold and its person is in
 *     the scene (named in the latest reply or the player's message, or travelling with the party), or,
 *     without a person, one of its keys is said; in order, twelve a turn at most.
 *   - A condition may ask whether a person travels with the party.
 *   - Triggers `rest` (a rest the Game Master's sheet tags took), `travel` (the party sets out from one
 *     place for another) and `idle` (replies with nothing happening): one of them goes a turn, the one with
 *     the highest priority.
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
  storyState,
  storyTurn,
  storyTurnPromptText,
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
const [hob, wren, elder] = worldCast(game, thrushwick.id).filter((person) => person.named);
assert.ok(hob && wren && elder);

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [{ id: "act", kind: "number", initial: 1, gm: true }],
  knowledge: [
    { id: "hob-self", person: hob.id, text: "Hob was a miller's boy before the year stopped." },
    {
      id: "hob-act2",
      person: hob.id,
      text: "Hob now fears the mill.",
      if: [{ flag: "act", is: ">=", value: 2 }],
    },
    { id: "hob-on-elder", person: hob.id, keys: ["bells"], text: "Hob thinks the bells are a lie." },
    { id: "the-mill", keys: ["mill", "millwheel"], text: "The mill's wheel has not turned in a hundred autumns." },
    {
      id: "wren-with-hob",
      person: wren.id,
      text: "Wren teases Hob about flour.",
      if: [{ party: hob.id, is: "in" }],
    },
  ],
  events: [
    { id: "camp-hob", when: { on: "rest" }, priority: 1, do: [{ tell: "Hob speaks by the fire." }] },
    {
      id: "camp-both",
      when: { on: "rest", rest: "long" },
      priority: 5,
      if: [
        { party: hob.id, is: "in" },
        { party: wren.id, is: "in" },
      ],
      repeat: true,
      do: [{ tell: "Hob and Wren argue by the fire." }],
    },
    { id: "road", when: { on: "travel", to: sallowford.id }, do: [{ tell: "Wren points out the old road." }] },
    { id: "lull", when: { on: "idle", turns: 3 }, do: [{ tell: "Hob comes to the player." }] },
  ],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 349);
assert.equal(
  storyCapabilityMinor({ ...story, events: [], knowledge: story.knowledge.slice(0, 4) }),
  348,
  "knowledge alone needs 1.348",
);

// ── Refused whole ──
const bad = (patch: Partial<StoryScriptInput>, issue: RegExp) => {
  const result = checkStoryScript(game, { ...input, ...patch });
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
bad({ knowledge: [{ id: "x", text: "Nobody's." }] }, /needs a person or keys/);
bad({ knowledge: [{ id: "x", person: "zz-9", text: "x" }] }, /no person "zz-9"/);
bad(
  { events: [{ id: "x", when: { on: "start" }, if: [{ party: "zz-9", is: "in" }], do: [{ tell: "x" }] }] },
  /no person "zz-9"/,
);
bad({ events: [{ id: "x", when: { on: "travel", to: "nowhere" }, do: [{ tell: "x" }] }] }, /no place "nowhere"/);
bad({ knowledge: [input.knowledge![0]!, input.knowledge![0]!] }, /Two knowledge entries/);

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
const said = (turn: ReturnType<typeof turnOf>) => turn.knowledge.map((known) => known.text);

// ── What people know ──
{
  const quiet = turnOf(["The square is empty."]);
  assert.deepEqual(said(quiet), [], "nobody in the scene");
  const named = turnOf([`${hob.name} waves.`]);
  assert.deepEqual(said(named), ["Hob was a miller's boy before the year stopped."]);
  assert.equal(named.knowledge[0]!.who, hob.name);
  const asked = turnOf([`${hob.name} waves.`], { player: "What about the bells, and the mill?" });
  assert.deepEqual(said(asked), [
    "Hob was a miller's boy before the year stopped.",
    "Hob thinks the bells are a lie.",
    "The mill's wheel has not turned in a hundred autumns.",
  ]);
  const later = turnOf([`[story: set="act=2" result="ok"]${hob.name} waves.`]);
  assert.ok(said(later).includes("Hob now fears the mill."), "it changes as the story moves");
  const travelling = turnOf(["The road is long."], { party: [hob.name, wren.name] });
  assert.deepEqual(said(travelling), [
    "Hob was a miller's boy before the year stopped.",
    "Wren teases Hob about flour.",
  ]);
  assert.deepEqual(travelling.party.sort(), [hob.id, wren.id].sort());
  const prompt = storyTurnPromptText(story, travelling);
  assert.ok(prompt.includes(`- ${wren.name}: Wren teases Hob about flour.`), prompt);
  // Twelve a turn at most.
  const many = checkStoryScript(game, {
    ...input,
    knowledge: Array.from({ length: 20 }, (_, index) => ({ id: `k${index}`, keys: ["mill"], text: `Fact ${index}.` })),
  });
  assert.ok(many.ok);
  assert.equal(
    storyTurn(many.story, {
      game,
      replies: ["The mill."],
      repliesBefore: 1,
      latest: "The mill.",
      told: [],
      day: 0,
      fight: null,
    }).knowledge.length,
    12,
  );
}

// ── Scenes on a rest: one a turn, by priority ──
{
  const rested = `The party makes camp. [sheet: who="${hob.name}" op="rest" rest="long" result="ok" now="rested"]`;
  const alone = turnOf([rested], { party: [hob.name] });
  assert.deepEqual(alone.tripped, ["camp-hob"], "the pair's scene needs both in the party");
  const both = turnOf([rested], { party: [hob.name, wren.name] });
  assert.deepEqual(both.tripped, ["camp-both"], "one scene a rest: the higher priority");
  const short = turnOf([rested.replace('rest="long"', 'rest="short"')], { party: [hob.name, wren.name] });
  assert.deepEqual(short.tripped, ["camp-hob"], "the pair's scene waits for a long rest");
  const refused = turnOf([rested.replace('result="ok"', 'result="refused"')], { party: [hob.name] });
  assert.deepEqual(refused.tripped, [], "a refused rest is no rest");
  // Once, unless it repeats; a repeating one again on the next rest.
  const again = turnOf([`${both.prepend}By the fire.`, rested], { party: [hob.name, wren.name] });
  assert.deepEqual(again.tripped, ["camp-both"]);
  // The Game Master marks a party-held event only while the party holds it.
  const gmStory = checkStoryScript(game, {
    ...input,
    events: [{ id: "gm-pair", when: { on: "gm" }, gm: true, if: [{ party: hob.id, is: "in" }], do: [{ tell: "x" }] }],
  });
  assert.ok(gmStory.ok);
  const tag = '[story: event="gm-pair"]';
  const state = storyState(gmStory.story, []);
  assert.match(applyStoryTags(tag, gmStory.story, game, state, [], undefined, new Set([hob.id])), /result="ok"/);
  assert.match(applyStoryTags(tag, gmStory.story, game, state, [], undefined, new Set()), /result="refused"/);
}

// ── Travel and quiet spells ──
{
  const setOut = turnOf(["They pack."], { told: [{ at: "Sallowford" }] });
  assert.deepEqual(setOut.tripped, ["road"]);
  const wrongWay = turnOf([`[world: at="Sallowford"]They arrive.`], { told: [{ at: "Thrushwick" }] });
  assert.deepEqual(wrongWay.tripped, [], "only on the way to Sallowford");
  const lull = turnOf(["Rain.", "More rain.", "Still rain."]);
  assert.deepEqual(lull.tripped, ["lull"]);
  assert.deepEqual(turnOf(["Rain.", "[state: combat]", "Rain."]).tripped, [], "a fight is not a lull");
  assert.ok(readStoryLedger([lull.prepend]).some((entry) => entry.event === "lull"));
}

console.log("Story knowledge and companion scenes: told while they hold, one scene a rest, by priority.");
