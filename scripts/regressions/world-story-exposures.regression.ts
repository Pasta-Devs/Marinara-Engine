/**
 * What being in a place does to the party over time (Capability API 1.362): Noonfield's light outside a fight.
 *
 *   - A story's `exposures` name a place, how many hours there bite once, and what a bite does: tracks
 *     moved and conditions put on, for each of the party, while its `if` holds.
 *   - On the game's clock: the turn the party is first there starts it; each later turn counts the bites
 *     since, marks them on the party's sheets with the Engine's own `[sheet:]` commands, and tells the
 *     Game Master; leaving, or its `if` no longer holding, ends it. Recorded once, never twice.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createSheetCommandTagRegex,
  parseSheetCommandTagBody,
  parseWorldKit,
  readStoryLedger,
  storyCapabilityMinor,
  storyState,
  storyTurn,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";
import { gameClockMinutes } from "../../packages/server/src/services/game/time.service.js";

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
assert.ok(start, "the party starts somewhere");

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [{ id: "shaded", kind: "bool", initial: false }],
  exposures: [
    {
      id: "noonfield",
      place: start,
      label: "Noonfield's light",
      hours: 1,
      tracks: [{ track: "exhaustion", by: 1 }],
      applies: ["sunstruck"],
      if: [{ flag: "shaded", is: "=", value: false }],
      tell: "The light presses on them; darkness would be a mercy.",
    },
  ],
  events: [],
  cutscenes: [],
  fights: [],
  endings: [],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 362);
assert.ok(!checkStoryScript(game, { ...input, exposures: [{ ...input.exposures![0]!, place: "nowhere" }] }).ok);
assert.ok(
  !checkStoryScript(game, { ...input, exposures: [{ id: "x", place: start, hours: 1 }] } as StoryScriptInput).ok,
  "it does something",
);

const turnOf = (replies: string[], clock?: number) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    ...(clock !== undefined ? { clock } : {}),
  });

// Without a clock nothing is kept.
assert.equal(turnOf([]).prepend, "");
// The first turn there starts it.
const first = turnOf([], 600);
assert.match(first.prepend, /\[story: exposure="noonfield" since="600" bitten="0" by="engine" result="ok"\]/);
assert.equal(first.sheet, "");
assert.deepEqual(first.state.exposures, { noonfield: { since: 600, bitten: 0 } });
const replies = [`${first.prepend}Into the light.`];
// Two and a half hours later: two bites, marked on each of the party's sheets.
const second = turnOf(replies, 750);
assert.match(second.prepend, /exposure="noonfield" since="600" bitten="2"/);
const commands = [...second.sheet.matchAll(createSheetCommandTagRegex())].map((match) =>
  parseSheetCommandTagBody(match[1]!),
);
assert.deepEqual(
  commands.map((each) => [each.who, each.op]),
  [
    ["party", { op: "track", track: "exhaustion", by: 2 }],
    ["party", { op: "condition", condition: "sunstruck", active: true }],
  ],
);
assert.ok(
  second.tells.some(
    (tell) =>
      tell.startsWith("Noonfield's light has told on the party: 2 times more") &&
      tell.includes("darkness would be a mercy"),
  ),
  second.tells.join("\n"),
);
replies.push(`${second.prepend}It burns.`);
// The same time again: nothing more.
const again = turnOf(replies, 779);
assert.equal(again.sheet, "");
assert.doesNotMatch(again.prepend, /exposure=/);
// A third hour: one more.
const third = turnOf(replies, 780);
assert.match(third.sheet, /by="1"/);
replies.push(`${third.prepend}And burns.`);
// Shaded: it ends, and starts afresh when it holds again.
replies.push('[story: set="shaded=true" result="ok"] They raise the black canopy.');
const shaded = turnOf(replies, 900);
assert.match(shaded.prepend, /exposure="noonfield" since="" bitten="0"/);
assert.equal(shaded.sheet, "");
assert.equal(shaded.state.exposures, undefined);
replies.push(`${shaded.prepend}Cool dark.`);
assert.equal(storyState(story, readStoryLedger(replies)).exposures, undefined);
replies.push('[story: set="shaded=false" result="ok"] The canopy tears.');
assert.match(turnOf(replies, 1000).prepend, /since="1000" bitten="0"/);

// The game's clock in minutes.
assert.equal(gameClockMinutes({ day: 1, hour: 2, minute: 30 }), 24 * 60 + 150);
assert.equal(gameClockMinutes(undefined), undefined);

console.log("Story exposures: a place's time told on the party's sheets, once a bite, while it holds.");
