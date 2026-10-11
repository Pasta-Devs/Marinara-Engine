/**
 * Where death is held (Capability API 1.374): the showcase's valley as a story's region rule.
 *
 *   - A story's `heldGround` names a place (or the whole world), what it is called, the condition the
 *     felled take and the marks each felled character's tracks take, while its `if` holds.
 *   - The story's turn records the party coming onto it and leaving it (`[story: held=...]`), once each,
 *     and tells the Game Master; every turn it holds, the Game Master is told what it means.
 *   - What it recorded is the Held Ground (1.318) a ruleset fight started there is fought on.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  readStoryLedger,
  storyCapabilityMinor,
  storyHeldGroundNow,
  storyHeldGroundReleaseInFight,
  storyState,
  storyTurn,
  storyTurnPromptText,
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
  flags: [{ id: "year_turned", kind: "bool", initial: false }],
  heldGround: [
    {
      id: "valley",
      place: start,
      label: "The Held Autumn",
      condition: "felled",
      marks: [{ track: "owing", by: 1 }],
      if: [{ flag: "year_turned", is: "=", value: false }],
      tell: "Nobody here has died in forty years.",
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
assert.equal(storyCapabilityMinor(story), 374);
assert.ok(!checkStoryScript(game, { ...input, heldGround: [{ id: "x", place: "nowhere" }] }).ok, "a real place");
assert.ok(
  !checkStoryScript(game, { ...input, heldGround: [input.heldGround![0]!, input.heldGround![0]!] }).ok,
  "ids once",
);
assert.ok(checkStoryScript(game, { ...input, heldGround: [{ id: "world" }] }).ok, "the whole world");

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

// The first turn there: recorded and told.
const first = turnOf([]);
assert.match(first.prepend, /\[story: held="valley" by="engine" result="ok"\]/);
assert.equal(first.state.held, "valley");
assert.ok(
  first.tells.some((tell) => tell.startsWith("The Held Autumn: death is held here.") && tell.includes("forty years")),
  first.tells.join("\n"),
);
assert.match(storyTurnPromptText(story, first), /The Held Autumn: death is held here\./);
const replies = [`${first.prepend}The valley.`];
// Later turns: nothing more recorded, but the Game Master is still told what it means.
const later = turnOf(replies);
assert.doesNotMatch(later.prepend, /held=/);
assert.equal(later.tells.length, 0);
assert.match(storyTurnPromptText(story, later), /each felled character takes 1 owing/);
// What a fight started now is fought on.
assert.deepEqual(storyHeldGroundNow(story, storyState(story, readStoryLedger(replies))), {
  label: "The Held Autumn",
  condition: "felled",
  marks: [{ track: "owing", by: 1 }],
});
// The year turns: it lets go, once.
replies.push('[story: set="year_turned=true" result="ok"] The year turns.');
const turned = turnOf(replies);
assert.match(turned.prepend, /\[story: held="" by="engine" result="ok"\]/);
assert.ok(
  turned.tells.some((tell) => tell.includes("death is death again")),
  turned.tells.join("\n"),
);
replies.push(`${turned.prepend}Cold.`);
assert.equal(storyHeldGroundNow(story, storyState(story, readStoryLedger(replies))), null);
assert.doesNotMatch(storyTurnPromptText(story, turnOf(replies)), /death is held/);
// Its release (1.377): what letting it go does to a fight still running, the bonus read off the story.
assert.equal(turned.released?.felled, "die", "the felled die when left out");
assert.equal(turned.released?.id, "valley");
assert.equal(later.released, undefined);
const releasing = checkStoryScript(game, {
  ...input,
  flags: [...input.flags!, { id: "debts_settled", kind: "number", initial: 2 }],
  heldGround: [
    {
      ...input.heldGround![0]!,
      release: { felled: "down", owing: { track: "owing", bonus: { flag: "debts_settled" } } },
    },
  ],
});
assert.ok(releasing.ok, JSON.stringify(releasing));
assert.equal(storyCapabilityMinor(releasing.story), 377);
const releasingTurn = (rs: string[]) =>
  storyTurn(releasing.story, {
    game,
    replies: rs,
    repliesBefore: rs.length,
    latest: rs.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
  });
const on = [`${releasingTurn([]).prepend}In.`, '[story: set="year_turned=true" result="ok"] It turns.'];
assert.deepEqual(releasingTurn(on).released, {
  id: "valley",
  label: "The Held Autumn",
  felled: "down",
  owing: { track: "owing", bonus: 2 },
});
assert.ok(
  !checkStoryScript(game, {
    ...input,
    heldGround: [{ ...input.heldGround![0]!, release: { owing: { bonus: { flag: "year_turned" } } } }],
  }).ok,
  "a number flag",
);

// In a fight still running (1.377): what it did lets go of the held ground there and then.
{
  const finale = checkStoryScript(game, {
    ...input,
    flags: [...input.flags!, { id: "wheel", kind: "number", initial: 3 }],
    events: [
      {
        id: "wheel_runs_down",
        when: { on: "flags" },
        if: [{ flag: "wheel", is: "<=", value: 0 }],
        do: [{ set: "year_turned", value: true }],
      },
    ],
  });
  assert.ok(finale.ok, JSON.stringify(finale));
  // The Year-Wheel broken on the board (a prop this test's world has no battlefield for, so added as checked).
  finale.story.events.unshift({
    id: "wheel_breaks",
    when: { on: "broke", prop: "Year-Wheel" },
    do: [{ set: "year_turned", value: true }],
  } as (typeof finale.story.events)[number]);
  const opening = storyTurn(finale.story, {
    game,
    replies: [],
    repliesBefore: 0,
    latest: null,
    told: [],
    day: 0,
    fight: null,
  });
  const ledger = readStoryLedger([`${opening.prepend}In.`]);
  assert.equal(storyState(finale.story, ledger).held, "valley");
  assert.equal(storyHeldGroundReleaseInFight(finale.story, ledger, {}), null, "nothing done");
  assert.equal(storyHeldGroundReleaseInFight(finale.story, ledger, { broken: ["Barn door"] }), null);
  assert.equal(storyHeldGroundReleaseInFight(finale.story, ledger, { broken: ["year-wheel"] })?.id, "valley");
  // An item's use that runs the wheel down, and the flags event that sets off.
  const spend = (id: string, add: number) => ({ id, flag: "wheel", add });
  assert.equal(storyHeldGroundReleaseInFight(finale.story, ledger, { spends: [spend("a", -2)] }), null);
  assert.equal(
    storyHeldGroundReleaseInFight(finale.story, ledger, { spends: [spend("a", -2), spend("b", -1)] })?.felled,
    "die",
  );
}

// A script without it never records any.
const plain = checkStoryScript(game, { ...input, heldGround: [] });
assert.ok(plain.ok);
assert.doesNotMatch(
  storyTurn(plain.story, { game, replies: [], repliesBefore: 0, latest: null, told: [], day: 0, fight: null }).prepend,
  /held=/,
);

console.log("Story held ground: death held where the story says, recorded as the party comes and goes, and fought on.");
