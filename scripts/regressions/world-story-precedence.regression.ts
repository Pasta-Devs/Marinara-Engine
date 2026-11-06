/**
 * What wins when the story says more than one thing (Capability API 1.361).
 *
 *   - A season hold `over` everything inside it (`{ "season": { "to": "winter", "over": true } }`) beats
 *     every season there, the script's own and every other hold; `to: null` with `over` gives them back.
 *   - What people know is ranked: the people the scene names first, then what its words bring in, then the
 *     companions only travelling along, each rank shared out person by person.
 */
import assert from "node:assert/strict";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  parseWorldKit,
  storyCapabilityMinor,
  storyKnowledgeHere,
  storyPartyOf,
  storyPlaceSeasons,
  storySeasonAt,
  storyTurn,
  worldCast,
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
assert.ok(brief.ok, JSON.stringify(brief));
const stored = { seed: 7, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief: brief.brief };
const game: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };
const thrushwick = game.world.places.find((place) => place.name === "Thrushwick")!;
const sallowford = game.world.places.find((place) => place.name === "Sallowford")!;
const inside = game.world.places.find((place) => place.parentId === thrushwick.id);

// ── Seasons ──
const seasonsInput: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  seasons: [
    { place: thrushwick.id, season: "summer" },
    { place: sallowford.id, season: "spring" },
  ],
  events: [
    { id: "turning", when: { on: "turn", turn: 2 }, do: [{ season: { to: "winter", over: true } }] },
    { id: "thaw", when: { on: "turn", turn: 4 }, do: [{ season: { to: null, over: true } }] },
  ],
  cutscenes: [],
  fights: [],
  endings: [],
};
const seasons = checkStoryScript(game, seasonsInput);
assert.ok(seasons.ok, JSON.stringify(seasons));
assert.equal(storyCapabilityMinor(seasons.story), 361);
const heldAfter = (turns: number) => {
  const replies: string[] = [];
  let state = storyTurn(seasons.story, {
    game,
    replies,
    repliesBefore: 0,
    latest: null,
    told: [],
    day: 0,
    fight: null,
  });
  for (let turn = 1; turn < turns; turn++) {
    replies.push(`${state.prepend}Time passes.`);
    state = storyTurn(seasons.story, {
      game,
      replies,
      repliesBefore: replies.length,
      latest: replies.at(-1)!,
      told: [],
      day: 0,
      fight: null,
    });
  }
  return state.state.seasons;
};
const at = (held: ReturnType<typeof heldAfter>, placeId: string | null) =>
  storySeasonAt(seasons.story, held, game, placeId, 0).season;
const before = heldAfter(1);
assert.equal(at(before, thrushwick.id), "summer");
assert.equal(at(before, sallowford.id), "spring");
const turned = heldAfter(3);
assert.equal(at(turned, thrushwick.id), "winter", "the world hold beats a place's own season");
assert.equal(at(turned, sallowford.id), "winter");
if (inside) assert.equal(at(turned, inside.id), "winter");
assert.equal(storyPlaceSeasons(seasons.story, turned, game)[thrushwick.id], "winter");
const thawed = heldAfter(5);
assert.equal(at(thawed, thrushwick.id), "summer", "let go, the places' own come back");
// A place's hold over everything inside it, and a plain world hold that does not beat a place's own.
assert.equal(at({ [`${thrushwick.id}!`]: "autumn" }, thrushwick.id), "autumn");
assert.equal(at({ [`${thrushwick.id}!`]: "autumn" }, sallowford.id), "spring");
assert.equal(at({ "*": "winter" }, thrushwick.id), "summer", "without over, a place's own still wins");
assert.equal(at({ "*!": "winter", [`${thrushwick.id}!`]: "autumn" }, thrushwick.id), "winter", "the outermost wins");

// ── Knowledge, ranked ──
const people = [thrushwick, sallowford].flatMap((place) => worldCast(game, place.id).filter((each) => each.named));
const [jory, liesl, corrow, odile] = people;
assert.ok(jory && liesl && corrow && odile, "four named people");
const knowledgeInput: StoryScriptInput = {
  ...seasonsInput,
  seasons: [],
  events: [],
  knowledge: [
    ...Array.from({ length: 8 }, (_, index) => ({ id: `j${index}`, person: jory.id, text: `Jory ${index}.` })),
    ...Array.from({ length: 8 }, (_, index) => ({ id: `l${index}`, person: liesl.id, text: `Liesl ${index}.` })),
    { id: "c0", person: corrow.id, text: "Corrow 0." },
    { id: "c1", person: corrow.id, text: "Corrow 1." },
    { id: "o0", person: odile.id, text: "Odile 0." },
    { id: "mill", keys: ["mill"], text: "The mill." },
  ],
};
const knowing = checkStoryScript(game, knowledgeInput);
assert.ok(knowing.ok, JSON.stringify(knowing));
const party = storyPartyOf(game, knowing.story, [jory.name, liesl.name], 3);
const texts = (said: string[]) => storyKnowledgeHere(knowing.story, game, {}, party, said).map((each) => each.text);
const crowded = texts([`${corrow.name} and ${odile.name} speak of the mill.`]);
assert.equal(crowded.length, 12);
for (const fact of ["Corrow 0.", "Corrow 1.", "Odile 0.", "The mill."]) assert.ok(crowded.includes(fact), fact);
assert.equal(crowded.filter((each) => each.startsWith("Jory")).length, 4, "the rest shared out");
assert.equal(crowded.filter((each) => each.startsWith("Liesl")).length, 4);
// Named in the scene, a companion comes before one only travelling along.
const named = texts([`${liesl.name} sighs.`]);
assert.equal(named.filter((each) => each.startsWith("Liesl")).length, 8, "room left: theirs all");
assert.equal(named.filter((each) => each.startsWith("Jory")).length, 4);
// A crowded scene still leaves the companions travelling along a small share: one each.
const busyInput: StoryScriptInput = {
  ...knowledgeInput,
  knowledge: [
    ...knowledgeInput.knowledge!,
    ...Array.from({ length: 12 }, (_, index) => ({
      id: `cc${index}`,
      person: corrow.id,
      text: `Corrow more ${index}.`,
    })),
    ...Array.from({ length: 12 }, (_, index) => ({ id: `oo${index}`, person: odile.id, text: `Odile more ${index}.` })),
  ],
};
const busy = checkStoryScript(game, busyInput);
assert.ok(busy.ok, JSON.stringify(busy));
const busyTexts = storyKnowledgeHere(busy.story, game, {}, party, [`${corrow.name} and ${odile.name} argue.`]).map(
  (each) => each.text,
);
assert.equal(busyTexts.length, 12);
assert.equal(busyTexts.filter((each) => each.startsWith("Jory")).length, 1, "a travelling companion keeps one");
assert.equal(busyTexts.filter((each) => each.startsWith("Liesl")).length, 1);
assert.equal(busyTexts.filter((each) => each.startsWith("Corrow")).length, 5);
assert.equal(busyTexts.filter((each) => each.startsWith("Odile")).length, 5);
// Alone, one person still says what they know.
assert.equal(texts(["The road."]).length, 12);

console.log("Story precedence: a season hold over everything inside it, and knowledge ranked by who is in the scene.");
