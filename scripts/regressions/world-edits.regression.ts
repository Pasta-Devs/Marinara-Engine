/**
 * A world's edit layer (worldgen W9c).
 *
 *   - The layer is applied after the compile: painted ground, compiled places renamed (their old names
 *     still read as them, by the ledger and the Game Master's tags) or moved (the ways laid again),
 *     places and people added, drawn people renamed. No layer is the compiled world itself.
 *   - Hand edits never rewrite the past: the history is the compiled world's, and the living world
 *     leaves a settlement added by hand alone. Towns never move: places and people added by hand come
 *     last.
 *   - A layer is checked strictly when saved and applied leniently when read; the routes keep, check,
 *     clear and serve it, and a new game's world is held to the same check.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  applyWorldEdits,
  applyWorldTags,
  checkWorldBrief,
  checkWorldEdits,
  compileGameWorld,
  gameWorldFromMetadata,
  parseWorldKit,
  worldCast,
  worldCastSize,
  worldHistory,
  worldOverviewPromptText,
  worldPlaceByName,
  worldPresent,
  worldRoute,
  worldTown,
  worldTravelDays,
  type GameWorld,
  type WorldEdits,
  type WorldPlace,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-edits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const kit = parsed.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const checked = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "x",
  places: [{ name: "Ashford", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
  groups: [{ name: "The Wardens", kind: kit.groupKinds[0]!.id, seat: "Ashford", allies: [], rivals: [] }],
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Oswin", "Bryn", "Calla", "Doran"],
    family: ["Holt", "Drey", "Marrow", "Vane"],
    order: "given-family" as const,
  })),
});
assert.ok(checked.ok);
const inputs = { kit, seed: 4242, grounding: "expand" as const, brief: checked.brief };
const base: GameWorld = { ...inputs, world: compileGameWorld(inputs) };
const edited = (edits: WorldEdits): GameWorld => ({ ...inputs, edits, world: compileGameWorld({ ...inputs, edits }) });
const settlementsDepth = kit.layers.findIndex((layer) => layer.settlements);
const settlements = base.world.places.filter((place) => place.depth === settlementsDepth);
const byRank = [...settlements].sort((a, b) => b.rank! - a.rank! || a.id.localeCompare(b.id));
const city = settlements.find((place) => place.name === "Ashford")!;
const village = byRank.at(-1)!;
const castSize = (place: WorldPlace) => {
  const settlement = place.rank !== undefined ? place : base.world.places.find((each) => each.id === place.parentId);
  return settlement?.rank !== undefined ? worldCastSize(place, settlement) : 0;
};

try {
  // ── No layer is the compiled world itself ──
  assert.equal(compileGameWorld({ ...inputs, edits: undefined }), base.world, "the compile is shared");
  assert.equal(applyWorldEdits(kit, base.world, { editsVersion: 1 }), base.world, "an empty layer changes nothing");

  // ── Painted ground ──
  {
    const cell = 5 * base.world.width + 7;
    const other = (parseInt(base.world.ground[cell]!, 36) + 1) % base.world.terrain.length;
    const ground = ".".repeat(cell) + other.toString(36) + ".".repeat(base.world.ground.length - cell - 1);
    const world = edited({ editsVersion: 1, ground }).world;
    assert.equal(world.ground[cell], other.toString(36), "the painted cell");
    assert.equal(
      world.ground.slice(0, cell) + world.ground.slice(cell + 1),
      base.world.ground.slice(0, cell) + base.world.ground.slice(cell + 1),
      "only it",
    );
    // A whole map painted over: the ways are laid again over the new ground.
    const water = base.world.terrain.findIndex((id) => kit.terrain!.find((entry) => entry.id === id)?.kind === "water");
    assert.ok(water >= 0, "(the kit has water)");
    const flooded = edited({ editsVersion: 1, ground: water.toString(36).repeat(base.world.ground.length) }).world;
    assert.notDeepEqual(
      flooded.links.map((link) => link.way),
      base.world.links.map((link) => link.way),
      "the ways cross water now",
    );
  }

  // ── A place renamed: its old name still reads as it ──
  {
    const game = edited({ editsVersion: 1, places: [{ id: city.id, name: "Newhaven" }] });
    const renamed = game.world.places.find((place) => place.id === city.id)!;
    assert.equal(renamed.name, "Newhaven");
    assert.deepEqual(renamed.aliases, [city.name]);
    assert.equal(worldPlaceByName(game.world, city.name)?.id, city.id, "found by the old name");
    assert.equal(worldPlaceByName(game.world, "newhaven")?.id, city.id, "and the new");
    assert.match(
      worldOverviewPromptText(game),
      new RegExp(`Newhaven \\([^)]*once called ${city.name}`),
      "the Game Master is told what it was called",
    );
    // A tag the Game Master writes with the old name is answered with the new one, and folds.
    const answered = applyWorldTags(`[world: deed="improve" place="${city.name}"]`, game, []);
    assert.match(answered, /place="Newhaven"/);
    assert.match(answered, /result="ok"/);
    // The past is the compiled world's: told with the names it had then (the first history read here is
    // the edited world's, so nothing cached stands in for it).
    const past = worldHistory(game);
    assert.ok(
      past.events.some((event) => event.text.includes("Ashford")),
      "(Ashford's past is told)",
    );
    assert.ok(!past.events.some((event) => event.text.includes("Newhaven")), "not under its new name");
    assert.deepEqual(past, worldHistory(base));
    // A group seated there is still seated there: its people, its place in the overview, its doings.
    const groupsOf = (world: GameWorld) => worldCast(world, city.id).map((person) => person.group ?? null);
    assert.ok(groupsOf(base).includes("The Wardens"), "(some of the Wardens live in Ashford)");
    assert.deepEqual(groupsOf(game), groupsOf(base), "the Wardens still live there");
    assert.match(worldOverviewPromptText(game), /The Wardens \([^)]*at Newhaven/);
    const years = [{ days: "365" }, { days: "365" }, { days: "365" }];
    const renamedPresent = worldPresent(game, years);
    const plainPresent = worldPresent(base, years);
    assert.deepEqual(
      [renamedPresent.fortune, renamedPresent.relations, renamedPresent.leaders, renamedPresent.ruined],
      [plainPresent.fortune, plainPresent.relations, plainPresent.leaders, plainPresent.ruined],
      "the world goes on as it would have",
    );
  }

  // ── A settlement moved: its ways are laid again ──
  {
    const far = {
      x: village.at.x < base.world.width / 2 ? base.world.width - 2 : 1,
      y: village.at.y < base.world.height / 2 ? base.world.height - 2 : 1,
    };
    const game = edited({ editsVersion: 1, places: [{ id: village.id, at: far }] });
    assert.deepEqual(game.world.places.find((place) => place.id === village.id)!.at, far);
    const before = worldRoute(base.world, city.id, village.id)!;
    const after = worldRoute(game.world, city.id, village.id)!;
    assert.ok(before && after, "still reachable");
    assert.notEqual(after.days, before.days, "the trip takes another time");
    assert.deepEqual(worldHistory(game), worldHistory(base), "the past is the compiled world's");
    assert.deepEqual(worldTravelDays(game, city.id), worldTravelDays(base, city.id), "word travels the compiled ways");
  }

  // ── Places added by hand ──
  const top = base.world.places.find((place) => place.depth === settlementsDepth - 1 && place.id === city.parentId)!;
  const innerLayer = kit.layers[settlementsDepth + 1]!;
  const corner = { x: 2, y: 2 };
  const additions: WorldEdits = {
    editsVersion: 1,
    added: [
      {
        id: "e1",
        name: "Stonebridge",
        layer: kit.layers[settlementsDepth]!.id,
        parentId: top.id,
        at: corner,
        size: kit.sizes[0]!.id,
      },
      {
        id: "e2",
        name: "The Lantern",
        layer: innerLayer.id,
        parentId: city.id,
        at: city.at,
        tags: [kit.placeTags[0]!.id],
      },
    ],
    addedPeople: [
      { id: `${city.id}-e1`, placeId: city.id, name: "Wren Hollis", role: "a cartographer" },
      { id: "e2-e1", placeId: "e2", name: "Pell Garrow" },
    ],
    people: [{ id: `${city.id}-1`, name: "Old Tomas" }],
  };
  {
    assert.deepEqual(checkWorldEdits(kit, base.world, additions, castSize), [], "a layer that fits");
    const game = edited(additions);
    const bridge = game.world.places.find((place) => place.id === "e1")!;
    assert.equal(bridge.byHand, true);
    assert.equal(bridge.rank, 0, "a settlement of the kit's smallest size");
    assert.ok(
      game.world.links.some((link) => link.from === "e1" || link.to === "e1"),
      "the ways reach it",
    );
    assert.ok(worldRoute(game.world, city.id, "e1"), "and the party can walk there");
    assert.deepEqual(worldHistory(game), worldHistory(base), "no past for it, and none rewritten");
    // The living world leaves it alone, so the weeks already played are the same.
    // A ledger of its own, read first for the world without the edit: the present is kept per edit layer.
    const ledger = [{ days: "365" }, { days: "365" }, { days: "364" }];
    const plain = worldPresent(base, ledger);
    const present = worldPresent(game, ledger);
    assert.equal(typeof present.fortune.e1, "number", "Stonebridge is in the present");
    assert.equal(present.fortune.e1, worldPresent(game, []).fortune.e1, "its fortune as it started");
    assert.equal(plain.fortune.e1, undefined, "the world without the edit has no Stonebridge");
    assert.ok(plain.news.length > 0, "(three years of the world's own changes)");
    assert.deepEqual(present.news, plain.news, "the world's own changes are as they were");

    // The people: a drawn one renamed, one added, and the town as it was laid out.
    const cast = worldCast(game, city.id);
    const drawn = worldCast(base, city.id);
    assert.equal(cast.find((person) => person.id === `${city.id}-1`)!.name, "Old Tomas");
    assert.equal(cast.length, drawn.length + 1);
    const wren = cast.find((person) => person.id === `${city.id}-e1`)!;
    assert.deepEqual([wren.name, wren.role, wren.named], ["Wren Hollis", "a cartographer", true]);
    assert.deepEqual(worldCast(game, city.id), cast, "the same every time");
    const town = worldTown(game, city.id)!;
    const plainTown = worldTown(base, city.id)!;
    // Nothing in town moves: a building keeps its lot, or an empty home's lot goes to the place added by
    // hand, as it does to a place the story adds.
    for (const building of plainTown.buildings) {
      const same = town.buildings.find((each) => each.id === building.id);
      const there = town.buildings.find((each) => each.x === building.x && each.y === building.y);
      assert.ok(
        same ? same.x === building.x && same.y === building.y : building.people.length === 0 && there?.placeId === "e2",
        `${building.id} stays put`,
      );
    }
    for (const person of plainTown.people)
      assert.equal(town.homeOf[person.id], plainTown.homeOf[person.id], `${person.name} keeps their home`);
    const lantern = town.buildings.find((building) => building.placeId === "e2");
    assert.ok(lantern, "the place added by hand is a building");
    assert.deepEqual(
      lantern.people,
      worldCast(game, "e2").map((person) => person.id),
      "its people work there",
    );
    assert.ok(town.homeOf[wren.id], "the person added by hand has a home");
    for (const person of worldCast(game, "e2"))
      assert.equal(town.workOf[person.id], "e2", `${person.name} works at The Lantern`);
  }

  // ── A town whose settlements have places of their own (a town-scale kit): someone added by hand never
  // moves anyone already living there ──
  {
    const modern = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "modern_day")!);
    assert.ok(modern.ok);
    const townKit = modern.kit;
    const read = checkWorldBrief(townKit, {
      briefVersion: 1,
      premise: "x",
      peopleNames: townKit.cultures.map((culture) => ({
        culture: culture.id,
        given: ["Ama", "Tobin", "Hesk", "Mira", "Oswin", "Bryn", "Calla", "Doran"],
        family: ["Holt", "Drey", "Marrow", "Vane"],
        order: "given-family" as const,
      })),
    });
    assert.ok(read.ok);
    const townInputs = { kit: townKit, seed: 4242, grounding: "expand" as const, brief: read.brief };
    const plainGame: GameWorld = { ...townInputs, world: compileGameWorld(townInputs) };
    const home = plainGame.world.places.find(
      (place) => place.rank !== undefined && plainGame.world.places.some((each) => each.parentId === place.id),
    )!;
    assert.ok(home, "(a settlement with places of its own)");
    const edits: WorldEdits = {
      editsVersion: 1,
      addedPeople: [{ id: `${home.id}-e1`, placeId: home.id, name: "Wren Hollis" }],
    };
    const withWren: GameWorld = { ...townInputs, edits, world: compileGameWorld({ ...townInputs, edits }) };
    const before = worldTown(plainGame, home.id)!;
    const after = worldTown(withWren, home.id)!;
    for (const person of before.people)
      assert.equal(after.homeOf[person.id], before.homeOf[person.id], `${person.name} keeps their home`);
    assert.ok(after.homeOf[`${home.id}-e1`], "Wren has a home too");
  }

  // ── Checked strictly when saved ──
  {
    const issues = (edits: Omit<WorldEdits, "editsVersion">) =>
      checkWorldEdits(kit, base.world, { editsVersion: 1, ...edits }, castSize);
    assert.ok(issues({ ground: "0" })[0]!.includes("cells"), "a ground of the wrong size");
    assert.ok(issues({ places: [{ id: "p9999", name: "X" }] })[0]!.includes("No place"));
    assert.ok(issues({ places: [{ id: city.id, at: { x: 250, y: 1 } }] })[0]!.includes("off the map"));
    assert.ok(
      issues({ places: [{ id: city.id, name: village.name }] })[0]!.includes("Two places"),
      "a name another place has",
    );
    assert.ok(
      issues({
        places: [
          { id: city.id, name: "Newhaven" },
          { id: village.id, name: city.name },
        ],
      }).some((issue) => issue.includes("Two places")),
      "a renamed place keeps its old name, so no other place may take it",
    );
    assert.deepEqual(issues({ places: [{ id: city.id, name: "Newhaven" }] }), [], "a rename alone is fine");
    const bad = (add: Partial<NonNullable<WorldEdits["added"]>[number]>) =>
      issues({
        added: [{ id: "e1", name: "Q", layer: kit.layers[settlementsDepth]!.id, parentId: top.id, at: corner, ...add }],
      });
    assert.ok(bad({ layer: "galaxy" })[0]!.includes("no layer"));
    assert.ok(bad({ parentId: city.id })[0]!.includes("one layer out"), "a parent at the wrong depth");
    assert.ok(bad({ size: "megalopolis" })[0]!.includes("settlement size"));
    assert.ok(bad({ tags: ["nonsense"] })[0]!.includes("place tag"));
    assert.ok(issues({ people: [{ id: `${city.id}-999`, name: "Nobody" }] })[0]!.includes("No person"));
    const parentLater = issues({
      added: [additions.added![1]!, additions.added![0]!].map((add, at) => ({
        ...add,
        ...(at === 0 ? { parentId: "e1" } : {}),
      })),
    });
    assert.ok(parentLater[0]!.includes("one layer out"), "a place's parent is added before it");
    assert.ok(
      issues({ addedPeople: [{ id: `${top.id}-e1`, placeId: top.id, name: "Ghost" }] })[0]!.includes("settlement"),
      "nobody lives in a province",
    );
    // Read leniently: what no longer fits is skipped.
    const lenient = applyWorldEdits(kit, base.world, {
      editsVersion: 1,
      places: [{ id: "p9999", name: "X" }],
      added: [{ id: "e1", name: "Q", layer: "galaxy", at: corner }],
    });
    assert.equal(lenient.places.length, base.world.places.length);
  }

  // ── The routes ──
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  try {
    const chats = createChatsStorage(db);
    const chat = await chats.create({ name: "Edited", mode: "game", characterIds: [] });
    await chats.patchMetadata(chat.id, {
      gameWorldKit: kit,
      gameWorld: {
        seed: inputs.seed,
        generatorVersion: WORLD_GENERATOR_VERSION,
        grounding: "expand",
        brief: inputs.brief,
      },
    });
    const meta = async () => JSON.parse((await chats.getById(chat.id))!.metadata as string) as Record<string, any>;
    // A layer written around the editor's check (by another route) is not applied at all.
    const stored = {
      seed: inputs.seed,
      generatorVersion: WORLD_GENERATOR_VERSION,
      grounding: "expand",
      brief: inputs.brief,
    };
    await chats.patchMetadata(chat.id, {
      gameWorld: { ...stored, edits: { editsVersion: 1, places: [{ id: city.id, name: village.name }] } },
    });
    const around = gameWorldFromMetadata(await meta())!;
    assert.equal(around.edits, undefined);
    assert.equal(
      around.world.places.find((place) => place.id === city.id)!.name,
      city.name,
      "two places never share a name",
    );
    await chats.patchMetadata(chat.id, { gameWorld: stored });
    const listed = (await app.inject({ method: "GET", url: "/api/game/worlds" })).json().worlds;
    assert.deepEqual(
      listed.map((world: { chatId: string; edited: boolean; family: string }) => [
        world.chatId,
        world.edited,
        world.family,
      ]),
      [[chat.id, false, "fantasy"]],
    );
    const read = (await app.inject({ method: "GET", url: `/api/game/${chat.id}/world/edit` })).json();
    assert.equal(read.edits, null);
    assert.equal(read.world.ground, base.world.ground);
    assert.equal(read.world.terrain.length, base.world.terrain.length);
    assert.ok(
      read.world.terrain.every((entry: { look: string }) => typeof entry.look === "string"),
      "each class has its look",
    );
    assert.equal(read.world.places.length, base.world.places.length);

    const save = (edits: unknown) =>
      app.inject({ method: "PUT", url: `/api/game/${chat.id}/world/edits`, payload: { edits } });
    const saved = await save(additions);
    assert.equal(saved.statusCode, 200, saved.body);
    const again = await save({ ...additions, places: [{ id: city.id, name: "Newhaven" }] });
    assert.equal(again.statusCode, 200, `a world saved again is checked as compiled: ${again.body}`);
    assert.equal((await save(additions)).statusCode, 200);
    assert.deepEqual((await meta()).gameWorld.edits, additions, "kept with the world");
    // A maker screen sends the layer it opened: a save by another writer meanwhile is refused, not replaced.
    const stale = await app.inject({
      method: "PUT",
      url: `/api/game/${chat.id}/world/edits`,
      payload: { edits: additions, expected: { editsVersion: 1 } },
    });
    assert.equal(stale.statusCode, 409, stale.body);
    assert.equal(stale.json().reason, "stale");
    assert.deepEqual(stale.json().edits, additions, "it comes with the layer that is stored now");
    assert.deepEqual((await meta()).gameWorld.edits, additions, "and the refused draft changed nothing");
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: `/api/game/${chat.id}/world/edits`,
          payload: { edits: additions, expected: additions },
        })
      ).statusCode,
      200,
      "the layer it opened saves",
    );
    assert.equal(
      gameWorldFromMetadata(await meta())!.world.places.find((place) => place.id === "e1")?.name,
      "Stonebridge",
      "and every reader sees it",
    );
    assert.ok(saved.json().links.some((link: { to: string; from: string }) => link.to === "e1" || link.from === "e1"));
    const people = (
      await app.inject({ method: "GET", url: `/api/game/${chat.id}/world/people?place=${city.id}` })
    ).json().people;
    assert.ok(people.some((person: { id: string; byHand: boolean }) => person.id === `${city.id}-e1` && person.byHand));
    const refused = await save({ editsVersion: 1, places: [{ id: "p9999", name: "X" }] });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.json().error, /No place/);
    assert.equal((await save({ editsVersion: 4 })).statusCode, 400, "a layer that does not read");
    assert.deepEqual((await meta()).gameWorld.edits, additions, "a refused layer changes nothing");
    assert.equal((await save({ editsVersion: 1 })).statusCode, 200);
    assert.equal("edits" in (await meta()).gameWorld, false, "an empty layer clears it");
    assert.equal((await app.inject({ method: "GET", url: `/api/game/nope/world/edit` })).statusCode, 404);

    // A new game's world is held to the same check.
    const create = (edits: unknown) =>
      app.inject({
        method: "POST",
        url: "/api/game/create",
        payload: {
          name: "Made",
          setupConfig: {
            genre: "Fantasy",
            setting: "x",
            tone: "x",
            difficulty: "normal",
            rating: "sfw",
            playerGoals: "",
            gmMode: "standalone",
            partyCharacterIds: [],
            worldKit: kit,
            world: {
              seed: inputs.seed,
              generatorVersion: WORLD_GENERATOR_VERSION,
              grounding: "expand",
              brief: inputs.brief,
              edits,
            },
          },
        },
      });
    const made = await create(additions);
    assert.equal(made.statusCode, 200, made.body);
    assert.deepEqual(JSON.parse(made.json().sessionChat.metadata).gameWorld.edits, additions);
    const unfit = await create({ editsVersion: 1, places: [{ id: "p9999", name: "X" }] });
    assert.equal(unfit.statusCode, 400, unfit.body);
    assert.match(unfit.json().error, /hand edits/);
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("World edits: the layer applies after the compile, keeps the past and the towns, and is checked.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
