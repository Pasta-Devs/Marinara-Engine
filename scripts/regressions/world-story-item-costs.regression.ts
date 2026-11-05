/**
 * Item uses that cost a story number (Capability API 1.359).
 *
 *   - An Experience's ruleset overlay names items (`storyUses`: `catalog/entry`, a story number flag, what
 *     a use adds to it, and `atLeast`). Each is an item of one of the merged ruleset's catalogs, once.
 *   - A fight's option that uses such an item (the acting fighter's sheet item at its place) is refused
 *     while the story's flag, its spends not yet recorded counted, is below `atLeast`.
 *   - What it spent is kept with the game and recorded by the next story turn, once (by its id), within
 *     the flag's bounds, and the Game Master is told.
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
  parseRulesetDefinition,
  parseWorldKit,
  readStoryLedger,
  storyState,
  storyTurn,
  type GameWorld,
  type RulesetEncounterState,
  type StorySpend,
} from "../../packages/shared/src/index.js";
// The server reads the merged ruleset's story costs as the built package keeps them, so it is merged
// with the built package here too.
import {
  applyExperienceRulesetOverlay,
  experienceStoryUse,
  readExperienceRulesetOverlay,
} from "../../packages/shared/dist/index.js";
import {
  gameStorySpends,
  storyItemUseVerdict,
  storyUseOfOption,
} from "../../packages/server/src/services/game/story-item-uses.service.js";

// ── The overlay ──
const text = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const parsed = parseRulesetDefinition(JSON.parse(text));
assert.ok(parsed.ok);
// The example ruleset has no item catalog; a catalog entry of its bestiary stands in for the item, as
// only its `catalog/entry` id is read here.
const items = parsed.definition.catalogs!.find((catalog) => catalog.id === "creatures")!;
const jar = { ...items.entries![0]!, id: "jar-of-someone-elses-death", label: "Jar of Someone Else's Death" };
const overlayOf = (storyUses: unknown[]) =>
  readExperienceRulesetOverlay(JSON.stringify({ overlayVersion: 1, creatures: [jar], storyUses }));
const jarRef = `${items.id}/jar-of-someone-elses-death`;
const read = overlayOf([{ item: jarRef, flag: "debts_settled", add: -2, atLeast: 2 }]);
assert.ok(read.ok, JSON.stringify(read));
const merged = applyExperienceRulesetOverlay(parsed.definition, read.overlay, false);
assert.ok(merged.ok, JSON.stringify(merged));
const definition = merged.definition;
assert.deepEqual(experienceStoryUse(definition, jarRef), { item: jarRef, flag: "debts_settled", add: -2, atLeast: 2 });
assert.equal(experienceStoryUse(parsed.definition, jarRef), undefined, "only the merged ruleset");
assert.ok(!overlayOf([{ item: "jar", flag: "x", add: -1 }]).ok, "named catalog/entry");
const why = (storyUses: unknown[], issue: RegExp) => {
  const each = overlayOf(storyUses);
  assert.ok(each.ok);
  const result = applyExperienceRulesetOverlay(parsed.definition, each.overlay, false);
  assert.ok(!result.ok && result.issues.some((message) => issue.test(message)), JSON.stringify(result));
};
why([{ item: "nowhere/jar", flag: "d", add: -1 }], /"nowhere\/jar" is in no catalog/);
why(
  [
    { item: jarRef, flag: "d", add: -1 },
    { item: jarRef, flag: "d", add: -2 },
  ],
  /named twice/,
);

// ── Which option uses it ──
const encounter = {
  order: ["liesl"],
  turn: 0,
  combatants: [
    {
      id: "liesl",
      sheet: {
        items: [
          { item: {}, quantity: 1, worn: false, name: "Rope", stack: { id: "s1", ref: `${items.id}/rope` } },
          { item: {}, quantity: 1, worn: false, name: "The Jar", stack: { id: "s2", ref: jarRef } },
        ],
      },
    },
  ],
} as unknown as RulesetEncounterState;
assert.equal(storyUseOfOption(definition, encounter, "use:0"), null, "no cost of its own");
assert.equal(storyUseOfOption(definition, encounter, "use:1")?.label, "The Jar");
assert.equal(storyUseOfOption(definition, encounter, "use:1:1")?.use.add, -2, "its other uses too");
assert.equal(storyUseOfOption(definition, encounter, "attack:0"), null);

// ── The story pays, or not ──
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
const checked = checkStoryScript(game, {
  storyVersion: 1,
  flags: [
    {
      id: "debts_settled",
      kind: "number",
      initial: 3,
      min: 0,
      clock: { title: "Debts Settled", segments: 6, full: "The ledger closes." },
    },
  ],
  events: [],
});
assert.ok(checked.ok, JSON.stringify(checked));
const story = checked.story;
const found = storyUseOfOption(definition, encounter, "use:1")!;

const first = storyItemUseVerdict(story, [], [], found);
assert.ok("spend" in first, JSON.stringify(first));
const spend: StorySpend = first.spend;
assert.deepEqual({ ...spend, id: "x" }, { id: "x", flag: "debts_settled", add: -2, label: "The Jar" });
// With it kept, the story has 1 left: the next use is refused.
const second = storyItemUseVerdict(story, [], [spend], found);
assert.deepEqual(second, { refusal: "The Jar needs 2 Debts Settled; the party has 1." });
assert.match(
  (storyItemUseVerdict(null, [], [], found) as { refusal: string }).refusal,
  /needs a story this game does not have/,
);

// ── Recorded by the next story turn, once ──
const turnOf = (replies: string[], spends: StorySpend[]) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    spends,
  });
const kept = gameStorySpends({ gameStorySpends: [spend, { id: "bad" }, { ...spend, id: "s2", add: -5 }] });
assert.equal(kept.length, 2, "only spends that read");
const recorded = turnOf([], kept);
assert.match(
  recorded.prepend,
  new RegExp(`\\[story: spend="${spend.id}" flag="debts_settled" set="debts_settled=1" by="engine" result="ok"\\]`),
);
assert.match(recorded.prepend, /spend="s2" flag="debts_settled" set="debts_settled=0"/, "kept within its min");
assert.equal(recorded.state.flags.debts_settled, 0);
assert.ok(recorded.tells.includes("Using The Jar cost the party 2 of Debts Settled; it is 1 now."));
const reply = `${recorded.prepend}The jar breaks.`;
assert.equal(storyState(story, readStoryLedger([reply])).flags.debts_settled, 0);
const again = turnOf([reply], kept);
assert.doesNotMatch(again.prepend, /spend=/, "recorded once");
assert.equal(again.state.flags.debts_settled, 0);
// A regenerated reply is gone from the replies, so its spends are recorded again in the new one.
assert.match(turnOf([], kept).prepend, new RegExp(`spend="${spend.id}"`));

console.log("Story item costs: refused while the story cannot pay, recorded once when it does.");
