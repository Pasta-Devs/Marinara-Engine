/**
 * Held seasons (Capability API 1.351), and room for 256 flags (1.353).
 *
 *   - A story holds places at a season whatever the date (`seasons`), a place and every place inside it, or
 *     the whole world; the `season` action changes one, or lets it go, during play.
 *   - The season where the party is reaches the Game Master, and the map draws each cell in the season of
 *     the place it lies nearest.
 *   - A battlefield may be painted with seasons, what a fight's tiles start in (`.` the place's own).
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
  storyPlaceSeasons,
  storySeasonAt,
  storyState,
  storyTurn,
  storyTurnPromptText,
  worldBattlefieldIssues,
  worldBattlefieldMade,
  worldBattlefieldMapSchema,
  worldSeason,
  worldSeasonCells,
  type GameWorld,
  type StoryScriptInput,
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
    given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato"],
    family: ["Arnwald", "Fennick", "Holt", "Marrow"],
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
// A day of high summer, so a held season is never the date's by chance.
const day = 120;
assert.equal(worldSeason(day), "summer");

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  seasons: [{ place: thrushwick.id, season: "autumn" }],
  events: [
    { id: "frost", when: { on: "start" }, do: [{ season: { place: sallowford.id, to: "winter" } }] },
    { id: "thaw", when: { on: "gm" }, gm: true, do: [{ season: { place: sallowford.id, to: null } }] },
  ],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 351);
assert.equal(storyCapabilityMinor({ ...story, seasons: [], events: [] }), 0);

// A story may hold 256 flags (1.353), a number each for a companion's approval and quest.
const many = checkStoryScript(game, {
  ...input,
  seasons: [],
  events: [],
  flags: Array.from({ length: 256 }, (_, n) => ({ id: `f${n}`, kind: "number" as const, initial: 0 })),
});
assert.ok(many.ok, JSON.stringify(many));
assert.equal(storyCapabilityMinor(many.story), 353);
assert.equal(
  checkStoryScript(game, {
    ...input,
    flags: Array.from({ length: 257 }, (_, n) => ({ id: `f${n}`, kind: "number" as const, initial: 0 })),
  }).ok,
  false,
);

// ── Refused whole ──
const bad = (patch: Partial<StoryScriptInput>, issue: RegExp) => {
  const result = checkStoryScript(game, { ...input, ...patch });
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
bad({ seasons: [{ season: "winter" }, { season: "spring" }] }, /Two seasons hold "the world"/);
bad({ seasons: [{ place: "zz", season: "winter" }] }, /zz/);

// ── Where it holds ──
assert.deepEqual(storySeasonAt(story, undefined, game, thrushwick.id, day), { season: "autumn", held: true });
assert.deepEqual(storySeasonAt(story, undefined, game, sallowford.id, day), { season: "summer", held: false });

// The opening event holds Sallowford at winter, kept in the ledger.
const opening = storyTurn(story, {
  game,
  replies: [],
  repliesBefore: 0,
  latest: null,
  told: [],
  day,
  fight: null,
});
assert.deepEqual(opening.tripped, ["frost"]);
const state = storyState(story, readStoryLedger([opening.prepend]));
assert.deepEqual(state.seasons, { [sallowford.id]: "winter" });
const held = storyPlaceSeasons(story, state.seasons, game);
assert.equal(held[sallowford.id], "winter");
assert.equal(held[thrushwick.id], "autumn");
assert.equal(held["*"], undefined, "the world is not held, only its places");

// The Game Master is told it where the party is.
const there = storyTurn(story, {
  game,
  replies: [opening.prepend, `[world: at="Sallowford"]They arrive.`],
  repliesBefore: 2,
  latest: `[world: at="Sallowford"]They arrive.`,
  told: [{ at: "Sallowford" }],
  day,
  fight: null,
});
assert.deepEqual(there.season, { season: "winter", held: true });
assert.ok(storyTurnPromptText(story, there).includes("It is winter here, whatever the date"));

// Letting one go: the date's season again (or the script's own, where it has one).
const thaw = applyStoryTags('[story: event="thaw"]', story, game, state, [], undefined, new Set());
assert.match(thaw, /result="ok"/);
const thawed = storyState(story, readStoryLedger([opening.prepend, thaw]));
assert.deepEqual(storySeasonAt(story, thawed.seasons, game, sallowford.id, day), { season: "summer", held: false });

// ── The map: each cell in its nearest place's season ──
const cells = worldSeasonCells(game, held)!;
assert.equal(cells.length, game.world.width * game.world.height);
assert.equal(cells[sallowford.at.y * game.world.width + sallowford.at.x], "winter");
assert.equal(cells[thrushwick.at.y * game.world.width + thrushwick.at.x], "autumn");
assert.equal(worldSeasonCells(game, {}), null, "nothing held: the date's season everywhere");
// The world held whole: every cell.
const whole = checkStoryScript(game, { ...input, seasons: [{ season: "winter" }], events: [] });
assert.ok(whole.ok);
const wholeHeld = storyPlaceSeasons(whole.story, undefined, game);
assert.equal(wholeHeld["*"], "winter");
assert.ok(worldSeasonCells(game, wholeHeld)!.every((season) => season === "winter"));

// ── Boards painted with seasons ──
const board = worldBattlefieldMapSchema.parse({
  id: "b1",
  name: "The mill race",
  place: thrushwick.id,
  size: "small",
  scene: "forest",
  rows: ["ppff", "ppff"],
  seasons: ["aa..", "ww.."],
  seasonKeys: { a: "autumn", w: "winter" },
});
const made = worldBattlefieldMade(board, "spring");
assert.deepEqual(made.seasons, {
  "0,0": "autumn",
  "1,0": "autumn",
  "2,0": "spring",
  "3,0": "spring",
  "0,1": "winter",
  "1,1": "winter",
  "2,1": "spring",
  "3,1": "spring",
});
assert.equal(worldBattlefieldMade({ ...board, seasons: undefined }).seasons, undefined);
assert.ok(
  worldBattlefieldIssues({ ...board, seasons: ["aa."] }).some((issue) => /not the shape/.test(issue)),
  "a season row per tile row",
);
assert.ok(
  worldBattlefieldIssues({ ...board, seasons: ["aazz", "ww.."] }).some((issue) => /z, which seasonKeys/.test(issue)),
);

console.log("Held seasons: places held whatever the date, drawn and told so, boards painted with them.");
