/**
 * Maps for places (map editor Phase 3, the Game Mode side, generated): a place in town that reads as a
 * cave, a mine, a crypt or a sewer (by its name and tags) is one the party can go down into from where
 * it stands. Its map is laid out from the game and the place's name, kept with the place's id, the same
 * one while the party is on it, and leaving it puts the party back in town where it went down. A place
 * that is not one to go down into (an inn) has no map.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DUNGEON_EXIT_PROP,
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  dungeonFromGameDungeonMap,
  dungeonPath,
  worldTownPath,
  createConnectionSchema,
  DUNGEON_SETS,
  dungeonSetForPlace,
  dungeonWayOutId,
  dungeonWayOutWords,
  gameDungeonMapPromptText,
  gameDungeonOnWayOut,
  gameDungeonWalkText,
  parseWorldKit,
  worldCast,
  type GameWorld,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-map-places-"));
process.env.DATA_DIR = dataDir;
// No local embedding model: memory recall would start fetching one after each turn and hold the process open.
process.env.MARINARA_LITE = "true";
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");

const gameOf = (id: string, seed: number): GameWorld => {
  const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === id)!);
  assert.ok(parsed.ok);
  const kit = parsed.kit;
  const checked = checkWorldBrief(kit, {
    briefVersion: 1,
    premise: "x",
    peopleNames: kit.cultures.map((culture) => ({
      culture: culture.id,
      given: ["Ama", "Tobin", "Hesk", "Mira", "Oswin", "Bryn", "Calla", "Doran"],
      family: ["Holt", "Drey", "Marrow", "Vane"],
      order: "given-family" as const,
    })),
  });
  assert.ok(checked.ok);
  const inputs = { kit, seed, grounding: "expand" as const, brief: checked.brief };
  return { ...inputs, world: compileGameWorld(inputs) };
};

try {
  // ── Which places are ones to go down into, and their look ──
  const look = (name: string, family = "fantasy", tags: string[] = []) =>
    dungeonSetForPlace({ name, tags }, family)?.id ?? null;
  assert.equal(look("The Old Mine"), "cave_rock");
  assert.equal(look("Wolf Den Caves"), "cave_rock");
  assert.equal(look("Frozen Grotto"), "cave_ice");
  assert.equal(look("The Ember Caves of Magma Deep"), "cave_lava", "lava before cave");
  assert.equal(look("Crystal Cavern"), "cave_crystal");
  assert.equal(look("The King's Crypt"), "dungeon_crypt");
  assert.equal(look("City Sewers", "modern"), "dungeon_sewer");
  // A building gone bad is laid out to a plan (building plans, 2026-11-14); one in use stays a building.
  assert.equal(look("Ruined Chapel"), "building_temple");
  assert.equal(look("Haunted Manor"), "building_manor");
  assert.equal(look("The Fallen Keep"), "building_keep");
  assert.equal(look("Haunted Manor", "scifi"), null, "never in science fiction");
  assert.equal(look("Ruined Temple Ruins"), "building_temple");
  assert.equal(look("Old Watchtower", "fantasy", ["ruin"]), "dungeon_temple", "a ruin by its tags");
  assert.equal(look("Deep Shaft", "fantasy", ["mine"]), "cave_rock", "a mine by its tags");
  for (const name of ["The Gilded Gull", "Temple of the Dawn", "Frozen Flagon", "Gem Merchant", "Hollow Oak Inn"])
    assert.equal(look(name), null, `${name} is not one to go down into`);
  assert.equal(look("Glassblower", "fantasy", ["gemstone", "volcanic", "port"]), null, "only the tags mine and ruin");
  assert.equal(look("Police Station", "modern"), null, "a station is a station only in science fiction");
  assert.equal(look("Aircraft Hangar", "modern"), null, "and a hangar a hangar");
  for (const name of ["Research Station", "Maglev Station", "Open Deck", "Rooftop Garden", "Research Lab"])
    assert.equal(look(name, "scifi"), null, `${name} is a building like any other`);
  assert.equal(look("Orbital Station Kepler", "scifi"), "station_corridor");
  assert.equal(look("Derelict Research Lab", "scifi"), "station_lab");
  assert.equal(look("Reactor Bunker", "scifi"), "station_engine");
  assert.equal(look("Cold War Bunker", "modern"), "station_corridor", "a bunker anywhere");

  // The way out in words for leaving by it.
  const wayOut = (id: string) => dungeonWayOutWords(DUNGEON_SETS.find((set) => set.id === id)!);
  assert.equal(wayOut("cave_rock"), "the ladder");
  assert.equal(wayOut("dungeon_crypt"), "the stairs");
  assert.equal(wayOut("dungeon_sewer"), "the ladder");
  assert.equal(wayOut("station_lab"), "the ladder hatch");
  // The client shows the way out by id, in the reader's language.
  const wayOutId = (id: string) => dungeonWayOutId(DUNGEON_SETS.find((set) => set.id === id)!);
  assert.deepEqual(["cave_rock", "dungeon_crypt", "station_lab"].map(wayOutId), ["ladder", "stairs", "ladder_hatch"]);
  assert.equal(dungeonWayOutId(undefined), "way_out");

  // ── Through the routes ──
  const game = gameOf("high_fantasy", 21);
  const settlements = game.world.places.filter((place) => place.rank !== undefined);
  const city = settlements.reduce((best, place) => (place.rank! > best.rank! ? place : best));
  const prompts: string[] = [];
  const standIn = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    prompts.push(body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Dark." } }],
      }),
    );
  });
  await new Promise<void>((resolve) => standIn.listen(0, "127.0.0.1", resolve));
  const address = standIn.address();
  assert.ok(address && typeof address !== "string");
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  await app.register(generateRoutes, { prefix: "/api/generate" });
  try {
    const connection = await createConnectionsStorage(db).create(
      createConnectionSchema.parse({
        name: "Stand-in",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "stand-in",
        apiKey: "sk-stand-in",
      }),
    );
    const chats = createChatsStorage(db);
    const chat = await chats.create({ name: "Mine", mode: "game", characterIds: [], connectionId: connection!.id });
    const chatId = chat.id;
    await chats.patchMetadata(chatId, {
      gameId: `mine-${chatId}`,
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameWorldKit: game.kit,
      gameWorld: { seed: game.seed, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand", brief: game.brief },
      gameTime: { day: 1, hour: 10, minute: 0 },
    });
    await chats.createMessage({
      chatId,
      role: "assistant",
      content:
        `The gates. [place: name="${city.name}" result="ok"] ` +
        `[world: fact="place" name="The Old Mine" in="${city.name}" result="ok"] ` +
        `[world: fact="place" name="The Gilded Gull" in="${city.name}" result="ok"]`,
    });
    const meta = async () => JSON.parse((await chats.getById(chatId))!.metadata as string) as Record<string, any>;
    const read = async () => (await app.inject({ method: "GET", url: `/api/game/${chatId}/town` })).json().town;
    const visit = (to: string) =>
      app.inject({ method: "POST", url: `/api/game/${chatId}/town/visit`, payload: { to } });
    const enter = (at: string) => app.inject({ method: "POST", url: `/api/game/${chatId}/map/enter`, payload: { at } });
    const buildings = (await read()).buildings as Array<{ id: string; name?: string; placeId?: string }>;
    const mine = buildings.find((building) => building.name === "The Old Mine")!;
    const inn = buildings.find((building) => building.name === "The Gilded Gull")!;
    assert.ok(mine && inn, "both places are buildings in town");

    assert.equal((await enter(mine.id)).statusCode, 400, "only where the party stands");
    assert.equal((await visit(mine.id)).statusCode, 200);
    const entered = await enter(mine.id);
    assert.equal(entered.statusCode, 200, entered.body);
    const map = entered.json().map;
    assert.equal(map.name, "The Old Mine");
    assert.equal(map.set, "cave_rock");
    assert.equal(map.place, mine.placeId, "kept with the place");
    assert.deepEqual(map.at, map.entrance, "in at the way in");
    assert.equal((await meta()).gameDungeonMap.id, map.id);
    assert.equal((await meta()).gameDungeonView, "map");
    assert.equal((await enter(mine.id)).json().map.id, map.id, "the same map while the party is on it");

    // The next turn tells the Game Master the map.
    const turn = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, userMessage: "We light a lamp.", streaming: false },
    });
    assert.equal(turn.statusCode, 200, turn.body);
    assert.equal((await meta()).gameDungeonMap.id, map.id, "a turn keeps it");

    // Out by the way in: back in town, at the mine.
    assert.equal(map.props[map.at.y * map.width + map.at.x], String(DUNGEON_EXIT_PROP));
    const left = await app.inject({ method: "POST", url: `/api/game/${chatId}/map/leave`, payload: { map: map.id } });
    assert.equal(left.statusCode, 200, left.body);
    assert.equal((await meta()).gameDungeonMap, null);
    assert.equal((await read()).at, mine.id, "the party stands where it went down");
    const again = (await enter(mine.id)).json().map;
    assert.notEqual(again.id, map.id, "a new visit");
    assert.equal(again.ground, map.ground, "the same place, the same map");

    // On another map (one the Game Master opened), going down is refused and that map kept.
    const other = { ...again, id: "gm-map", name: "The Pit", place: undefined };
    await chats.patchMetadata(chatId, {
      gameDungeonMap: other,
      gameDungeonWalk: { id: "w1", map: "gm-map", from: other.at, to: other.at, minutes: 3 },
    });
    assert.equal((await enter(mine.id)).statusCode, 409, "leave the other map first");
    assert.equal((await meta()).gameDungeonMap.id, "gm-map", "that map is kept");
    assert.equal((await meta()).gameDungeonWalk.minutes, 3, "and its walk not yet told");
    await chats.patchMetadata(chatId, { gameDungeonMap: again, gameDungeonWalk: null });

    // An inn is not one to go down into.
    await app.inject({ method: "POST", url: `/api/game/${chatId}/map/leave`, payload: { map: again.id } });
    assert.equal((await visit(inn.id)).statusCode, 200);
    assert.equal((await enter(inn.id)).statusCode, 400, "no going down in an inn");
    assert.equal((await meta()).gameDungeonMap, null);

    // A place with a map made for it by hand (map editor Phase 3): that map is gone down into, whatever
    // its name, its props never in the way, and out where the party came in.
    // Someone of the city stands by the pool by day.
    const smith = worldCast(game, city.id)[0]!;
    const rows = ["########", "#......#", "#..~~..#", "#......#", "#......#", "########"];
    const handMap = {
      id: "m1",
      place: "e1",
      pack: "local/cave-ice",
      width: 8,
      height: 6,
      ground: rows.join(""),
      entry: { x: 1, y: 4 },
      props: [{ tile: "dn_prop1", x: 3, y: 1 }],
      spots: [{ id: "s1", x: 2, y: 1, name: "By the pool", people: [smith.id], from: 8, to: 18 }],
    };
    const saved = await app.inject({
      method: "PUT",
      url: `/api/game/${chatId}/world/edits`,
      payload: {
        edits: {
          editsVersion: 3,
          // A place added by hand in the city, named like any building: the map makes it one to go down into.
          added: [{ id: "e1", name: "Old Granary", layer: "quarter", parentId: city.id, at: city.at }],
          maps: [handMap],
        },
      },
    });
    assert.equal(saved.statusCode, 200, saved.body);
    const quarter = ((await read()).buildings as typeof buildings).find((building) => building.placeId === "e1")!;
    assert.ok(quarter, "the added place is a building in town");
    assert.equal((await visit(quarter.id)).statusCode, 200);
    const handEntered = await enter(quarter.id);
    assert.equal(handEntered.statusCode, 200, handEntered.body);
    const kept = handEntered.json().map;
    assert.equal(kept.hand, true);
    assert.equal(kept.ground, rows.join(""), "the map as made");
    assert.equal(kept.pack, "local/cave-ice", "drawn from its own pack");
    assert.deepEqual(kept.at, handMap.entry, "in at its entry");
    assert.equal(kept.props[1 * 8 + 3], "1", "its prop in its slot");
    // Told to the Game Master without areas: what is on it, where the way out is, where the party is.
    const told = gameDungeonMapPromptText(kept);
    assert.match(told, /^MAP: Old Granary\. /u);
    assert.match(
      told,
      /^MAP: Old Granary\. A place made by hand, with liquid in it\. The way out is where the party came in\. The party is by the way out\.$/u,
    );
    assert.doesNotMatch(told, /area \d|passage/u, "no areas on a map made by hand");
    assert.deepEqual(kept.spots, [
      { x: 2, y: 1, name: "By the pool", people: [{ id: smith.id, name: smith.name }], from: 8, to: 18 },
    ]);
    assert.match(gameDungeonMapPromptText(kept, 9), new RegExp(`Here now: By the pool: ${smith.name}\\.$`, "u"));
    assert.doesNotMatch(gameDungeonMapPromptText(kept, 20), /Here now/u, "nobody there at night");
    assert.equal(
      gameDungeonWalkText(kept, { id: "w", map: kept.id, from: kept.at, to: { x: 3, y: 1 }, minutes: 1 }),
      "The party walked across Old Granary (1 minute).",
    );
    const onProp = await app.inject({
      method: "POST",
      url: `/api/game/${chatId}/map/walk`,
      payload: { map: kept.id, x: 3, y: 1 },
    });
    assert.equal(onProp.statusCode, 200, onProp.body);
    const leaveHand = () =>
      app.inject({ method: "POST", url: `/api/game/${chatId}/map/leave`, payload: { map: kept.id } });
    assert.equal((await leaveHand()).statusCode, 400, "the way out is where the party came in");
    assert.equal(
      gameDungeonOnWayOut({ ...kept, at: { x: 3, y: 1 }, props: kept.props.replace(/1/u, "5") }),
      false,
      "a way-out prop on a map made by hand is drawn only",
    );
    await app.inject({
      method: "POST",
      url: `/api/game/${chatId}/map/walk`,
      payload: { map: kept.id, ...handMap.entry },
    });
    assert.equal((await leaveHand()).statusCode, 200);
    assert.equal((await read()).at, quarter.id, "back in town");

    // ── Story events on the cells a walk walks (map events, Pixelforge's step trigger) ──
    // A cell in the middle of a walk to the square trips its event, one off the walk does not; on the map
    // made by hand the same; each told once, by the next turn.
    const town = await read();
    const toSquare = worldTownPath(town, town.at, "square")!;
    const walked = toSquare[Math.floor(toSquare.length / 2)]!;
    const onWay = new Set(toSquare.map((cell) => `${cell.x},${cell.y}`));
    let away: { x: number; y: number } | undefined;
    for (let y = 0; y < town.height && !away; y++)
      for (let x = 0; x < town.width && !away; x++)
        if (town.ground[y * town.width + x] === "s" && !onWay.has(`${x},${y}`)) away = { x, y };
    const mapCells = dungeonFromGameDungeonMap(kept);
    const across = dungeonPath(mapCells, handMap.entry, { x: 6, y: 1 })!;
    const mapWalked = across[Math.floor(across.length / 2)]!;
    // A floor cell the walk does not cross.
    const crossed = new Set([`${handMap.entry.x},${handMap.entry.y}`, ...across.map((cell) => `${cell.x},${cell.y}`)]);
    let unwalked: { x: number; y: number } | undefined;
    for (let y = 1; y < 5 && !unwalked; y++)
      for (let x = 1; x < 7 && !unwalked; x++)
        if (rows[y]![x] === "." && !crossed.has(`${x},${y}`)) unwalked = { x, y };
    const story = {
      storyVersion: 1,
      events: [
        { id: "bell", when: { on: "step", place: city.id, ...walked }, do: [{ tell: "A bell rings in the street." }] },
        { id: "quiet", when: { on: "step", place: city.id, ...away! }, do: [{ tell: "Nobody passes here." }] },
        { id: "dust", when: { on: "step", place: "e1", ...mapWalked }, do: [{ tell: "Dust falls from the rafters." }] },
        { id: "rat", when: { on: "step", place: "e1", ...unwalked! }, do: [{ tell: "A rat watches." }] },
      ],
    };
    const world = (await app.inject({ method: "GET", url: `/api/game/${chatId}/world` })).json().world;
    const fits = checkStoryScript(world, story);
    assert.ok(fits.ok, JSON.stringify(!fits.ok && fits.issues));
    await chats.patchMetadata(chatId, { gameStory: story });
    const storyTurn = async () => {
      prompts.length = 0;
      const answered = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId, userMessage: "We go on.", streaming: false },
      });
      assert.equal(answered.statusCode, 200, answered.body);
      return prompts.join("\n");
    };
    assert.equal((await visit("square")).statusCode, 200);
    assert.ok(
      (await meta()).gameTownVisit.steps.some(
        (cell: { x: number; y: number }) => cell.x === walked.x && cell.y === walked.y,
      ),
    );
    const afterTown = await storyTurn();
    assert.match(afterTown, /A bell rings in the street\./u, "a walked cell's event");
    assert.doesNotMatch(afterTown, /Nobody passes here/u, "never a cell off the walk");
    assert.doesNotMatch(await storyTurn(), /A bell rings/u, "told once, by the turn that told the walk");
    // On the map made by hand.
    assert.equal((await visit(quarter.id)).statusCode, 200);
    const back = (await enter(quarter.id)).json().map;
    const mapWalk = await app.inject({
      method: "POST",
      url: `/api/game/${chatId}/map/walk`,
      payload: { map: back.id, x: 6, y: 1 },
    });
    assert.equal(mapWalk.statusCode, 200, mapWalk.body);
    assert.equal((await meta()).gameDungeonWalk.place, "e1", "a hand-made map's walk names its place");
    const afterMap = await storyTurn();
    assert.match(afterMap, /Dust falls from the rafters\./u);
    assert.doesNotMatch(afterMap, /A rat watches/u);
  } finally {
    await app.close();
    await closeDB();
    await new Promise<void>((resolve) => standIn.close(() => resolve()));
  }

  console.log("Map places: caves, mines and crypts in town are gone down into, and left back into town.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
