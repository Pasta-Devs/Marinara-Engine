/**
 * An Experience's own looks for its maps made by hand (Capability API 1.357).
 *
 *   - A map pack may ship dungeon looks (`mapPack.dungeons`: .tilepack.json files laid out as a dungeon
 *     set), each named by its id from a hand map's `pack`. Each must draw a floor and a wall, and no two
 *     share an id. They need an Experience that declares 1.357.
 *   - A hand map may carry its own words (floor, wall, liquid, each prop slot): the kept map keeps them
 *     and the Game Master is told the map in them, so an outdoor site reads as what it is.
 */
import assert from "node:assert/strict";

import {
  WORLD_STARTER_KITS,
  capabilityPackageManifestSchema,
  dungeonFromGameDungeonMap,
  gameDungeonMapFromPlaceMap,
  gameDungeonMapPromptText,
  gameDungeonMapSchema,
  parseWorldKit,
  worldKitFile,
  worldMapWordsSchema,
  DUNGEON_SETS,
  type TilePack,
  type WorldPlaceMap,
} from "../../packages/shared/src/index.js";
import { checkMapPackFiles, type MapPackFiles } from "../../packages/server/src/services/game/map-pack.service.js";
import { imageTilePack } from "./fixtures/image-tile-pack.js";

// ── A hand map's own words ──
const rows = ["########", "#......#", "#..~~..#", "#......#", "########"];
const hand: WorldPlaceMap = {
  id: "m1",
  place: "p3",
  pack: "held-autumn/maze",
  width: 8,
  height: 5,
  ground: rows.join(""),
  entry: { x: 1, y: 1 },
  props: [
    { tile: "dn_prop0", x: 2, y: 1 },
    { tile: "dn_prop0", x: 3, y: 3 },
    { tile: "dn_prop2", x: 6, y: 3 },
    { tile: "dn_prop1", x: 5, y: 1 },
  ],
  words: {
    floor: "stubbled earth",
    wall: "walls of standing corn",
    liquid: "a ditch of rainwater",
    props: ["a scarecrow", null, "a corn-dolly shrine"],
  },
};
assert.ok(!worldMapWordsSchema.safeParse({ floor: "x", sky: "blue" }).success, "strict");
assert.ok(!worldMapWordsSchema.safeParse({ props: Array.from({ length: 9 }, () => "x") }).success, "8 slots");
assert.ok(!worldMapWordsSchema.safeParse({ floor: "a\nb" }).success, "one line");

const set = DUNGEON_SETS.find((each) => each.id === "dungeon_crypt")!;
const kept = gameDungeonMapSchema.parse(gameDungeonMapFromPlaceMap(hand, "The Maze", set, "k1", "p3"));
assert.deepEqual(kept.words, hand.words, "the kept map keeps its words");
assert.deepEqual(dungeonFromGameDungeonMap(kept).words, hand.words);
const told = gameDungeonMapPromptText(kept);
assert.equal(
  told,
  "MAP: The Maze. A place made by hand (stubbled earth, walls of standing corn), with a ditch of rainwater in it; in it: a scarecrow (2), a corn-dolly shrine. The way out is where the party came in. The party is by the way out.",
);
assert.doesNotMatch(told, /sarcophagus|flagstones/, "never the set's words");
// Without words: as before.
const { words: _words, ...plain } = hand;
assert.match(
  gameDungeonMapPromptText(gameDungeonMapSchema.parse(gameDungeonMapFromPlaceMap(plain, "The Maze", set, "k2", "p3"))),
  /A place made by hand, with liquid in it\. The way out/,
);

// ── The manifest names its looks ──
const manifest = (dungeons: unknown, minor = 357) =>
  capabilityPackageManifestSchema.safeParse({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "held-autumn",
    name: "The Held Autumn",
    version: "1.0.0",
    description: "An Experience.",
    engine: { min: "2.3.0", maxExclusive: "99.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: {
      slots: ["game-surface"],
      gameSurface: { setup: {}, mapPack: { kit: "map/v.worldkit.json", dungeons } },
      assets: { paths: ["map/v.worldkit.json", "map/maze.tilepack.json"] },
    },
    files: [
      { path: "client.js", sha256: "0".repeat(64), bytes: 1 },
      { path: "map/v.worldkit.json", sha256: "0".repeat(64), bytes: 1 },
      { path: "map/maze.tilepack.json", sha256: "0".repeat(64), bytes: 1 },
    ],
    permissions: ["ui"],
    restartRequired: false,
  });
const named = manifest(["map/maze.tilepack.json"]);
assert.ok(named.success, JSON.stringify(!named.success && named.error.issues));
assert.ok(!manifest(["map/maze.tilepack.json"], 356).success, "needs 1.357");
assert.ok(!manifest(["map/maze.json"]).success, "a .tilepack.json file");
assert.ok(!manifest(["map/other.tilepack.json"]).success, "declared among its assets");

// ── Read with the pack ──
const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
// Image packs: the dungeon tiles are drawn only from one, as the library's sets are.
const look = (id: string, tiles: Record<string, Array<{ sheet: string; x: number; y: number }>>): TilePack =>
  imageTilePack({ id, name: "Corn maze", tiles }) as TilePack;
const maze = look("held-autumn/maze", {
  dn_floor: [{ sheet: "town", x: 0, y: 0 }],
  dn_wall: [{ sheet: "town", x: 2, y: 0 }],
  dn_prop0: [{ sheet: "town", x: 3, y: 0 }],
});
const files = (dungeons: TilePack[], minor = 357): MapPackFiles => ({
  version: "1.0.0",
  name: "The Held Autumn",
  kit: Buffer.from(JSON.stringify(worldKitFile(parsedKit.kit))),
  worlds: [],
  tiles: null,
  tilesSha256: null,
  capabilityApi: { major: 1, minor },
  creatures: [],
  music: null,
  people: null,
  assets: [],
  rulesets: [],
  dungeons: dungeons.map((pack, index) => ({
    path: `map/look${index}.tilepack.json`,
    data: Buffer.from(JSON.stringify(pack)),
    sha256: String(index),
  })),
});
const read = await checkMapPackFiles("held-autumn", files([maze]), { cache: false });
assert.ok(read.ok, JSON.stringify(read));
assert.deepEqual(
  read.pack.dungeons?.map((each) => each.id),
  ["held-autumn/maze"],
);
const why = async (input: MapPackFiles, reason: RegExp) => {
  const result = await checkMapPackFiles("held-autumn", input, { cache: false });
  assert.ok(!result.ok && reason.test(result.reason), JSON.stringify(result));
};
await why(files([maze], 356), /look0\.tilepack\.json is a dungeon look, which needs capabilityApi 1\.357/);
await why(
  files([look("held-autumn/bare", { dn_floor: [{ sheet: "town", x: 0, y: 0 }] })]),
  /has no dn_wall, which a dungeon look needs/,
);
await why(files([maze, maze]), /look1\.tilepack\.json is called "held-autumn\/maze", as another/);
await why(files([{ ...maze, sheets: [] } as unknown as TilePack]), /look0\.tilepack\.json does not read/);
const none = await checkMapPackFiles("held-autumn", files([]), { cache: false });
assert.ok(none.ok && !none.pack.dungeons, "none shipped, none read");

console.log("Experience dungeon looks: hand maps drawn and told in an Experience's own looks.");
