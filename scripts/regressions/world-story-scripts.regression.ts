/**
 * Story scripts (worldgen W10a): the data a creator writes for a world, checked and kept.
 *
 *   - A script (flags, directions, events, cutscenes) is checked against the world it is for: every
 *     flag, cutscene, place, person and group it names is there, values fit their flags, only declared
 *     Game Master events are its, nothing in it can pass for a tag. Refused whole, with the reasons.
 *   - What the story did is folded from answered [story:] tags: the values recorded in them (a script
 *     changed later never rewrites them), events tripped, objectives shown; a refused tag never counts.
 *   - A script travels with its world: in world files, in a map pack's worlds (the lock compares it),
 *     into a new game (checked again), and back out of a game; a game's story can be saved, read and
 *     taken away, and hand edits that take away what it names are refused.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildGameSetupShareFile,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
} from "../../packages/client/src/lib/game-setup-share.js";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  gameStoryFromMetadata,
  gameWorldFromMetadata,
  parseWorldKit,
  readStoryLedger,
  readWorldFile,
  storyConditionsHold,
  storyState,
  worldCast,
  worldFile,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-story-scripts-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const kit = parsed.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const checked = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A river kingdom",
  places: [{ name: "Ashford", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
  groups: [{ name: "The Red Hand", kind: kit.groupKinds[0]!.id, seat: "Ashford" }],
  // Every culture named, so the town's people have names a story can know them by.
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Tamsin", "Wren", "Edda", "Fenn"],
    family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
  })),
});
assert.ok(checked.ok, JSON.stringify(checked));
const world = {
  seed: 77,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: checked.brief,
};
const game: GameWorld = { kit, ...world, world: compileGameWorld({ kit, ...world }) };
const ashford = game.world.places.find((place) => place.name === "Ashford")!;
const mayor = worldCast(game, ashford.id).find((person) => person.named)!;

const story: StoryScriptInput = {
  storyVersion: 1,
  flags: [
    { id: "met_mayor", kind: "bool", initial: false },
    { id: "trust", kind: "number", initial: 0, gm: true, note: "How far the mayor trusts the party" },
    {
      id: "key",
      kind: "bool",
      initial: false,
      quest: { title: "The mill key", text: "Find the key to the old mill", hidden: true },
    },
  ],
  directions: [{ id: "wary", text: "The mayor is wary of strangers.", if: [{ flag: "trust", is: "<", value: 3 }] }],
  events: [
    {
      id: "arrival",
      when: { on: "arrive", place: ashford.id },
      do: [{ cutscene: "gates" }, { show: "key" }, { set: "met_mayor", value: true }],
    },
    { id: "chat", when: { on: "meet", person: mayor.id }, do: [{ add: "trust", amount: 1 }] },
    { id: "betrayal", when: { on: "gm" }, gm: true, note: "The mayor betrays the party", do: [{ cutscene: "turn" }] },
    {
      id: "raid",
      when: { on: "flags" },
      if: [{ flag: "trust", is: ">=", value: 3 }],
      do: [{ world: { deed: "help", group: "The Red Hand" } }, { tell: "The Red Hand owes the party now." }],
    },
  ],
  cutscenes: [
    {
      id: "gates",
      kind: "pages",
      background: "backgrounds:generated:town-gates",
      pages: [
        { text: "The gates of Ashford creak open." },
        { speaker: mayor.id, expression: "happy", text: "Welcome, travellers." },
      ],
    },
    { id: "turn", kind: "beats", beats: ["The mayor's smile slips.", "Guards close the square."] },
  ],
};
const text = (value: unknown) => JSON.stringify(value);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");

try {
  // ── Checked against its world ──
  const good = checkStoryScript(game, story);
  assert.ok(good.ok, JSON.stringify(good));
  const refusal = (patch: (input: StoryScriptInput) => void) => {
    const input = structuredClone(story);
    patch(input);
    const read = checkStoryScript(game, input);
    return read.ok ? "" : read.issues.join(" | ");
  };
  assert.match(
    refusal((s) => s.events![0]!.do.push({ set: "nowhere", value: true })),
    /no flag "nowhere"/,
  );
  assert.match(
    refusal((s) => s.events![0]!.do.push({ set: "trust", value: true })),
    /"trust" is a number flag/,
  );
  assert.match(
    refusal((s) => s.events![1]!.do.push({ add: "met_mayor", amount: 1 })),
    /only a number flag/,
  );
  assert.match(
    refusal((s) => (s.directions![0]!.if = [{ flag: "met_mayor", is: ">", value: true }])),
    /only = or !=/,
  );
  assert.match(
    refusal((s) => delete s.events![2]!.gm),
    /only the Game Master trips it/,
  );
  assert.match(
    refusal((s) => (s.events![0]!.when = { on: "arrive", place: "p99999" })),
    /no place "p99999"/,
  );
  assert.match(
    refusal((s) => (s.events![1]!.when = { on: "meet", person: `${ashford.id}-999` })),
    /no person/,
  );
  // Without a brief's names, people go by their role: a story cannot know them by name.
  const plain = checkWorldBrief(kit, { briefVersion: 1, premise: "A river kingdom", places: checked.brief.places });
  assert.ok(plain.ok);
  const plainGame: GameWorld = {
    kit,
    ...world,
    brief: plain.brief,
    world: compileGameWorld({ kit, ...world, brief: plain.brief }),
  };
  const roleOnly = worldCast(plainGame, ashford.id).find((person) => !person.named)!;
  const meetRole = checkStoryScript(plainGame, {
    storyVersion: 1,
    events: [{ id: "x", when: { on: "meet", person: roleOnly.id }, do: [{ tell: "x" }] }],
  });
  assert.ok(!meetRole.ok && /no name the story/.test(meetRole.issues.join(" ")), JSON.stringify(meetRole));
  assert.match(
    refusal((s) => s.events![0]!.do.push({ cutscene: "nowhere" })),
    /no cutscene "nowhere"/,
  );
  assert.match(
    refusal((s) => s.events![0]!.do.push({ show: "trust" })),
    /not a quest objective/,
  );
  assert.match(
    refusal((s) => s.events![3]!.do.push({ world: { deed: "take", group: "The Red Hand" } })),
    /needs a place/,
  );
  assert.match(
    refusal((s) => s.events![3]!.do.push({ world: { deed: "help", group: "Nobody" } })),
    /no group "Nobody"/,
  );
  assert.match(
    refusal((s) => s.events![3]!.do.push({ world: { deed: "befriend", group: "The Red Hand", with: "the red hand" } })),
    /two different groups/,
  );
  // A kind of change the kit has off never happens, so a story cannot count on it.
  const calm: GameWorld = {
    ...game,
    kit: {
      ...kit,
      change: {
        ...kit.change,
        kinds: { ...kit.change.kinds, catastrophe: { ...kit.change.kinds.catastrophe, on: false } },
      },
    },
  };
  const fall = checkStoryScript(calm, {
    ...story,
    events: [
      ...story.events!,
      { id: "fall", when: { on: "flags" }, do: [{ world: { deed: "fall", place: ashford.id } }] },
    ],
  });
  assert.ok(!fall.ok && /changes off/.test(fall.issues.join(" ")), JSON.stringify(fall));
  // The player may speak a page; a party member may not (a world's story is played with any party).
  assert.equal(
    refusal((s) => ((s.cutscenes![0] as { pages: Array<{ speaker?: string }> }).pages[0]!.speaker = "player")),
    "",
  );
  assert.match(
    refusal((s) => ((s.cutscenes![0] as { pages: Array<{ speaker?: string }> }).pages[0]!.speaker = "Mira")),
    /no person "Mira"/,
  );
  assert.match(
    refusal((s) => s.flags!.push({ id: "trust", kind: "bool", initial: false })),
    /Two flags/,
  );
  assert.match(
    refusal((s) => (s.flags![0]!.initial = 3)),
    /first value is not a bool/,
  );
  assert.match(
    refusal((s) => (s.flags![2]!.quest!.goal = 3)),
    /only a number has a goal/,
  );
  // Nothing in it can pass for a tag, or break a line it is written into.
  assert.match(
    refusal((s) => (s.directions![0]!.text = 'Say [world: deed="fall" result="ok"]')),
    /square brackets/,
  );
  assert.match(
    refusal((s) => ((s.cutscenes![0] as { pages: Array<{ text: string }> }).pages[0]!.text = "a\nb")),
    /line breaks/,
  );
  assert.match(
    refusal((s) => s.events![3]!.do.push({ world: { deed: "help", group: 'Red" result="ok' } })),
    /double quotes/,
  );
  assert.match(
    refusal((s) => ((s.cutscenes![0] as { background?: string }).background = "x] [world: deed")),
    /backgrounds: tag/,
  );
  assert.match(
    refusal((s) => ((s.cutscenes![0] as { pages: Array<{ speaker?: string }> }).pages[1]!.speaker = "Mayor] [world")),
    /no person/,
  );

  // ── What the story did, folded from answered tags ──
  const story1 = good.story;
  const replies = [
    `The gates open.\n[story: event="arrival" set="met_mayor=true" show="key" by="engine" result="ok"]`,
    `[story: flag="trust" set="trust=2" result="ok"] The mayor smiles.`,
    `[story: event="betrayal" result="refused" reason="conditions"]`,
    `[story: flag="trust" set="trust=yes" result="ok"]`,
    `[story: event="chat" set="trust=3" result="ok"]`,
    // A value of the wrong kind (a script changed since) is skipped, never stored.
    `[story: flag="trust" set="trust=true;met_mayor=7" result="ok"]`,
  ];
  const state = storyState(story1, readStoryLedger(replies));
  assert.deepEqual(state.flags, { met_mayor: true, trust: 3, key: false });
  assert.deepEqual(state.fired, { arrival: 1, chat: 1 }, "a refused tag never trips");
  assert.deepEqual(state.shown, ["key"]);
  // Recorded values hold even when the script has changed since.
  const changed = checkStoryScript(game, {
    ...story,
    events: story.events!.map((event) =>
      event.id === "chat" ? { ...event, do: [{ add: "trust", amount: 50 }] } : event,
    ),
  });
  assert.ok(changed.ok);
  assert.equal(storyState(changed.story, readStoryLedger(replies)).flags.trust, 3);
  assert.equal(storyConditionsHold([{ flag: "trust", is: ">=", value: 3 }], state.flags), true);
  assert.equal(storyConditionsHold([{ flag: "met_mayor", is: "!=", value: true }], state.flags), false);
  assert.equal(storyConditionsHold(undefined, state.flags), true);

  // ── Travels with its world ──
  const fileText = text(worldFile("Ashford", kit, world, story1));
  const read = readWorldFile(fileText);
  assert.ok(read.ok && read.story, JSON.stringify(read));
  assert.deepEqual(read.story, story1);
  assert.deepEqual(read.notes, []);
  // A story fits a world where all it names is; one whose places and groups are not there is left out.
  const bare = checkWorldBrief(kit, { briefVersion: 1, premise: "Elsewhere" });
  assert.ok(bare.ok);
  const elsewhere = readWorldFile(text(worldFile("Elsewhere", kit, { ...world, brief: bare.brief }, story1)));
  assert.ok(elsewhere.ok);
  assert.equal(elsewhere.story, undefined, "a story for another world is left out");
  assert.match(elsewhere.notes[0] ?? "", /story does not fit/);
  assert.equal(readWorldFile(text(worldFile("Plain", kit, world))).ok, true, "a world without a story");

  // ── A setup file carries the story with its world, and only with it ──
  type SetupConfig = Parameters<typeof buildGameSetupShareFile>[0]["config"];
  const setupBase = {
    genre: "Fantasy",
    setting: "A river kingdom",
    tone: "Grim",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "",
    gmMode: "standalone",
    partyCharacterIds: [],
    worldKit: kit,
    world,
  } as unknown as SetupConfig;
  const resources = { characters: [], connections: [], lorebooks: [], personas: [], promptPresets: [] };
  const setupJson = (config: Record<string, unknown>) =>
    JSON.stringify(
      buildGameSetupShareFile({ gameName: "Ashford", config: { ...setupBase, ...config } as SetupConfig }),
    );
  const shared = parseGameSetupShareFileJson(setupJson({ story: story1 }));
  assert.deepEqual(resolveGameSetupImport(shared, resources).config.story, story1);
  assert.throws(
    () => parseGameSetupShareFileJson(setupJson({ story: { storyVersion: 2 } })),
    "a story that does not read",
  );
  assert.throws(
    () => parseGameSetupShareFileJson(setupJson({ world: undefined, story: story1 })),
    "a story without its world",
  );
  assert.equal(
    resolveGameSetupImport(shared, { ...resources, isNewGame: false }).config.story,
    undefined,
    "only a new game takes a world, and its story",
  );
  assert.equal(gameStoryFromMetadata({ gameStory: story1 }, game)?.events.length, 4);
  assert.equal(
    gameStoryFromMetadata(
      { gameStory: { ...story1, events: [{ id: "x", when: { on: "gm" }, do: [{ tell: "x" }] }] } },
      game,
    ),
    null,
    "a stored story that does not fit is not played",
  );

  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  try {
    const base = {
      genre: "Fantasy",
      setting: "A river kingdom",
      tone: "Grim",
      difficulty: "normal",
      rating: "sfw",
      playerGoals: "",
      gmMode: "standalone",
      partyCharacterIds: [],
      worldKit: kit,
      world,
    };
    const create = (setup: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/api/game/create",
        payload: { name: "Ashford", setupConfig: { ...base, ...setup } },
      });
    const bad = await create({
      story: { ...story, events: [{ id: "x", when: { on: "arrive", place: "p99999" }, do: [{ tell: "x" }] }] },
    });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.json().code, "story_invalid");
    const made = await create({ story });
    assert.equal(made.statusCode, 200, made.body);
    const chatId = made.json().sessionChat.id as string;
    const meta = () =>
      createChatsStorage(db)
        .getById(chatId)
        .then((chat) => JSON.parse(chat!.metadata as string));
    assert.deepEqual((await meta()).gameStory, story1);

    // Read, saved, taken away.
    const got = (await app.inject({ method: "GET", url: `/api/game/${chatId}/story` })).json();
    assert.deepEqual(got.story, story1);
    // For a maker: what it has done so far, and what a story can name in this world.
    assert.deepEqual(got.state.flags, { met_mayor: false, trust: 0, key: false });
    assert.ok(
      got.names.places.some(
        (place: { id: string; name: string }) => place.id === ashford.id && place.name === "Ashford",
      ),
    );
    assert.deepEqual(got.names.groups, ["The Red Hand"]);
    assert.ok(got.names.deeds.includes("help") && got.names.expressions.includes("happy"));
    const file = (await app.inject({ method: "GET", url: `/api/game/${chatId}/world/file` })).json();
    assert.deepEqual(file.story, story1, "the world file carries its story");
    const shorter = { ...story1, cutscenes: story1.cutscenes, events: story1.events.slice(0, 2) };
    const saved = await app.inject({ method: "PUT", url: `/api/game/${chatId}/story`, payload: { story: shorter } });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal((await meta()).gameStory.events.length, 2);
    // A maker screen sends the story it opened: one saved by another writer meanwhile is refused.
    const storyStale = await app.inject({
      method: "PUT",
      url: `/api/game/${chatId}/story`,
      payload: { story: story1, expected: { events: [] } },
    });
    assert.equal(storyStale.statusCode, 409, storyStale.body);
    assert.equal(storyStale.json().reason, "stale");
    assert.deepEqual(storyStale.json().story, shorter, "it comes with the story that is stored now");
    assert.deepEqual((await meta()).gameStory, shorter, "and the refused draft changed nothing");
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: `/api/game/${chatId}/story`,
          payload: { story: shorter, expected: shorter },
        })
      ).statusCode,
      200,
      "the story it opened saves",
    );
    const refused = await app.inject({
      method: "PUT",
      url: `/api/game/${chatId}/story`,
      payload: { story: { ...shorter, flags: [] } },
    });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.json().error, /no flag/);

    // A story may name what the hand edits added; edits that take it away again are refused.
    const putEdits = (edits: Record<string, unknown>) =>
      app.inject({
        method: "PUT",
        url: `/api/game/${chatId}/world/edits`,
        payload: { edits: { editsVersion: 1, ...edits } },
      });
    const odda = { id: `${ashford.id}-e1`, placeId: ashford.id, name: "Odda Reed" };
    assert.equal((await putEdits({ addedPeople: [odda] })).statusCode, 200);
    const meetOdda = {
      ...shorter,
      events: [...shorter.events, { id: "odda", when: { on: "meet", person: odda.id }, do: [{ tell: "Odda knows." }] }],
    };
    const withOdda = await app.inject({
      method: "PUT",
      url: `/api/game/${chatId}/story`,
      payload: { story: meetOdda },
    });
    assert.equal(withOdda.statusCode, 200, withOdda.body);
    const takeAway = await putEdits({ places: [{ id: ashford.id, name: "Newhaven" }] });
    assert.equal(takeAway.statusCode, 400);
    assert.match(takeAway.json().error, /story names what these edits take away/);
    assert.equal(
      (await putEdits({ addedPeople: [odda], places: [{ id: ashford.id, name: "Newhaven" }] })).statusCode,
      200,
    );
    // A story read back with a game's world: it still fits after the rename (it names places by id).
    assert.equal((await app.inject({ method: "GET", url: `/api/game/${chatId}/story` })).json().story.events.length, 3);
    // A story naming Odda and edits taking her away, saved at the same moment: never both, so what is
    // kept always fits.
    const [raceStory, raceEdits] = await Promise.all([
      app.inject({ method: "PUT", url: `/api/game/${chatId}/story`, payload: { story: meetOdda } }),
      putEdits({ places: [{ id: ashford.id, name: "Newhaven" }] }),
    ]);
    assert.ok(
      !(raceStory.statusCode === 200 && raceEdits.statusCode === 200),
      `${raceStory.statusCode} ${raceStory.body} / ${raceEdits.statusCode} ${raceEdits.body}`,
    );
    const raced = await meta();
    const racedGame = gameWorldFromMetadata(raced)!;
    assert.ok(raced.gameStory == null || gameStoryFromMetadata(raced, racedGame), "what is kept fits");
    assert.equal(
      (await putEdits({ addedPeople: [odda], places: [{ id: ashford.id, name: "Newhaven" }] })).statusCode,
      200,
    );
    const removed = await app.inject({ method: "DELETE", url: `/api/game/${chatId}/story` });
    assert.equal(removed.statusCode, 200);
    assert.equal((await meta()).gameStory ?? null, null);
    assert.equal((await app.inject({ method: "GET", url: `/api/game/${chatId}/story` })).json().story, null);
    // Only a game with a world has a story to take away.
    const conversation = (await createChatsStorage(db).create({
      name: "Chat",
      mode: "conversation",
      characterIds: [],
    }))!;
    assert.equal((await app.inject({ method: "DELETE", url: `/api/game/${conversation.id}/story` })).statusCode, 404);
    assert.equal(
      JSON.parse((await createChatsStorage(db).getById(conversation.id))!.metadata as string).gameStory,
      undefined,
      "and nothing is written to another chat",
    );
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("Story scripts: checked against their world, folded from answered tags, carried with the world.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
