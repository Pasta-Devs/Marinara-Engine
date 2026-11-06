/**
 * A story's sheet action (Capability API 1.368): Rime Edge's cold that no rest heals.
 *
 *   - `{ "sheet": { "condition": "<id>", "state": "on" | "off" } }` puts a sheet condition on each of the
 *     party or takes it off; `{ "sheet": { "track": "<id>", "by": n, "upTo"?: m } }` moves a track.
 *   - The Engine's own trip puts the party's sheet command on the reply it writes (`turn.sheet`, applied
 *     with the reply's own); the Game Master's trip has it applied on the turn after it marked it.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  applyStoryTags,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createSheetCommandTagRegex,
  parseSheetCommandTagBody,
  parseWorldKit,
  storyCapabilityMinor,
  storyState,
  storyTurn,
  readStoryLedger,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";

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
const start = game.world.startId!;

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  events: [
    {
      id: "rime_edge",
      when: { on: "arrive", place: start },
      do: [
        { sheet: { condition: "rime_cold", state: "on" } },
        { sheet: { track: "owing", by: 1, upTo: 3 } },
        { tell: "The rime gets into them; no rest will warm it out." },
      ],
    },
    {
      id: "thaw",
      when: { on: "gm" },
      gm: true,
      do: [{ sheet: { condition: "rime_cold", state: "off" } }],
    },
  ],
  cutscenes: [],
  fights: [],
  endings: [],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 368);
assert.ok(
  !checkStoryScript(game, {
    ...input,
    events: [{ ...input.events![0]!, do: [{ sheet: { condition: "rime_cold" } }] }],
  } as StoryScriptInput).ok,
  "on or off",
);

const ops = (sheet: string) =>
  [...sheet.matchAll(createSheetCommandTagRegex())].map((match) => {
    const parsed = parseSheetCommandTagBody(match[1]!);
    return [parsed.who, parsed.op];
  });
const turnOf = (replies: string[]) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
  });

// The Engine's own trip: on the reply it writes.
const first = turnOf([]);
assert.deepEqual(first.tripped, ["rime_edge"]);
assert.deepEqual(ops(first.sheet), [
  ["party", { op: "condition", condition: "rime_cold", active: true }],
  ["party", { op: "track", track: "owing", by: 1, upTo: 3 }],
]);
const replies = [`${first.prepend}The rime.`];
assert.equal(turnOf(replies).sheet, "", "once");

// The Game Master's trip: applied on the turn after it marked it.
const marked = applyStoryTags(
  'They light a fire. [story: event="thaw"]',
  story,
  game,
  storyState(story, readStoryLedger(replies)),
);
assert.match(marked, /event="thaw" result="ok"/);
replies.push(marked);
assert.deepEqual(ops(turnOf(replies).sheet), [["party", { op: "condition", condition: "rime_cold", active: false }]]);

console.log(
  "Story sheet actions: a condition put on or taken off the party, and a track moved, by the Engine's own commands.",
);
