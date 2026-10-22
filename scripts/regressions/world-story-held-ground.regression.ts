/**
 * Where death is held (Capability API 1.366): the showcase's valley as a story's region rule.
 *
 *   - A story's `heldGround` names a place (or the whole world), what it is called, the condition the
 *     felled take and the marks each felled character's tracks take, while its `if` holds.
 *   - The story's turn records the party coming onto it and leaving it (`[story: held=...]`), once each,
 *     and tells the Game Master; every turn it holds, the Game Master is told what it means.
 *   - What it recorded is the Held Ground (1.323) a ruleset fight started there is fought on.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseRulesetDefinition,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-held-ground-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [{ buildSkillCheckRulesetContext }, { heldGroundReleasedInFight, rollStoryOwingWith }] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/story-held-ground.service.js"),
]);

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
assert.equal(storyCapabilityMinor(story), 366);
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
// Its release (1.369): what letting it go does to a fight still running, the bonus read off the story.
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
assert.equal(storyCapabilityMinor(releasing.story), 369);
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

// In a fight still running (1.369): what it did lets go of the held ground there and then.
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

// ── The Owing out of a fight (1.369): each of the party rolls a dying save a mark, off their own sheet ──
{
  const fiveE = (() => {
    const doc = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
        "utf8",
      ),
    );
    // What an Experience's overlay adds (1.367): the Owing track.
    doc.sheet.live.tracks.push({ id: "owing", label: "Owing", min: 0, max: 10 });
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  })();
  const cards = [{ name: "Jory" }, { name: "Liesl" }, { name: "Hayward" }];
  const live = { jory: { tracks: { owing: 2 } }, hayward: { tracks: { owing: 3 } } };
  const context = {
    skills: null,
    attributes: null,
    sheetAttributes: {},
    ruleset: buildSkillCheckRulesetContext(fiveE, cards, cards[0], live),
  };
  const faces =
    (...values: number[]) =>
    () =>
      values.shift() ?? 10;
  const base = storyTurn(story, { game, replies: [], repliesBefore: 0, latest: null, told: [], day: 0, fight: null });
  const released = {
    id: "valley",
    label: "The Held Autumn",
    felled: "die" as const,
    owing: { track: "owing", bonus: 2 },
  };
  // Jory: 5 + 2 fails, 12 + 2 holds, and the marks run out alive. Hayward: a natural 1 is two failures,
  // 4 + 2 a third, and he dies. Liesl owes nothing and rolls nothing.
  const owed = rollStoryOwingWith(context, { gameCharacterCards: cards }, { ...base, released }, faces(5, 12, 1, 4));
  assert.equal(
    owed.sheet,
    [
      base.sheet,
      '[sheet: who="Jory" op="track" track="owing" by="-2"]',
      '[sheet: who="Jory" op="track" track="death_save_failures" to="0"]',
      '[sheet: who="Jory" op="track" track="death_save_successes" to="0"]',
      '[sheet: who="Hayward" op="track" track="owing" by="-3"]',
      '[sheet: who="Hayward" op="track" track="death_save_failures" to="3"]',
      '[sheet: who="Hayward" op="track" track="death_save_successes" to="0"]',
    ]
      .filter(Boolean)
      .join(" "),
  );
  const tell = owed.tells.at(-1)!;
  assert.match(tell, /Jory's debt comes due, 2 saves \(5 \+ 2, 12 \+ 2\), and they live/);
  assert.match(tell, /Hayward's debt comes due, 2 saves \(1 \+ 2, 4 \+ 2\), and they die/);
  assert.doesNotMatch(tell, /Liesl/);
  // Nothing let go, or no Owing: nothing rolled.
  assert.equal(rollStoryOwingWith(context, { gameCharacterCards: cards }, base, faces(1)), base);
  const quiet = { ...base, released: { id: "valley", felled: "die" as const } };
  assert.equal(rollStoryOwingWith(context, { gameCharacterCards: cards }, quiet, faces(1)), quiet);
  // A fight that let it go already rolled it: the turn recording it (and that turn regenerated) skips it.
  const meta = { gameHeldGroundReleased: { id: "valley", replies: 4 } };
  assert.equal(heldGroundReleasedInFight(meta, released, 4), true);
  assert.equal(heldGroundReleasedInFight(meta, released, 6), false, "a later letting go is its own");
  assert.equal(heldGroundReleasedInFight(meta, { ...released, id: "barrow" }, 4), false);
  assert.equal(heldGroundReleasedInFight({}, released, 4), false);
}

// A script without it never records any.
const plain = checkStoryScript(game, { ...input, heldGround: [] });
assert.ok(plain.ok);
assert.doesNotMatch(
  storyTurn(plain.story, { game, replies: [], repliesBefore: 0, latest: null, told: [], day: 0, fight: null }).prepend,
  /held=/,
);

console.log("Story held ground: death held where the story says, recorded as the party comes and goes, and fought on.");
