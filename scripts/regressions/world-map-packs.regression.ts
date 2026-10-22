/**
 * Experience map packs (worldgen W9e).
 *
 *   - A manifest may declare a map pack on its game surface from Capability API 1.72: its kit, worlds and
 *     tiles, each also a declared asset.
 *   - The Engine reads an installed Experience's pack through the verified asset path: a kit, worlds made
 *     with that kit, and a tile pack. A pack whose files do not read, whose world was made with another
 *     kit, or whose bytes are not the ones installed is refused whole, with the reason.
 *   - A new game with the Experience on is locked to the pack's kit, and to one of its worlds; it draws
 *     with the pack's tiles. An Experience without a pack locks nothing.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_SHARE_FILE_MAX_BYTES,
  WORLD_STARTER_KITS,
  capabilityPackageManifestSchema,
  checkWorldBrief,
  checkStoryScript,
  compileGameWorld,
  parseWorldKit,
  worldFile,
  worldKitFile,
  type TilePack,
} from "../../packages/shared/src/index.js";
import { imageTilePack, undecodablePng } from "./fixtures/image-tile-pack.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-world-map-packs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsed.ok);
const kit = { ...parsed.kit, id: "riverlands", label: "Riverlands kit" };
const checked = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "The river provinces quarrel.",
  places: [{ name: "Ashford", layer: "settlement", size: "city", tags: [] }],
});
assert.ok(checked.ok);
const worldOf = (seed: number) => ({
  seed,
  generatorVersion: WORLD_GENERATOR_VERSION,
  grounding: "expand" as const,
  brief: checked.brief,
});
const ashford = compileGameWorld({ kit, ...worldOf(9) }).places.find((place) => place.name === "Ashford")!;
const edits = { editsVersion: 1 as const, places: [{ id: ashford.id, name: "Newhaven" }] };
// A map may ship its story (worldgen W10): it is part of the map the game is locked to.
const parsedStory = checkStoryScript(
  { kit, ...worldOf(9), edits, world: compileGameWorld({ kit, ...worldOf(9), edits }) },
  { storyVersion: 1, events: [{ id: "home", when: { on: "arrive", place: ashford.id }, do: [{ tell: "Home." }] }] },
);
assert.ok(parsedStory.ok);
const story = parsedStory.story;
const rows = (char: string) => Array.from({ length: 16 }, () => char.repeat(16));
const tiles: TilePack = {
  tilePackVersion: 1,
  id: "riverlands-tiles",
  name: "Riverlands tiles",
  family: "fantasy",
  version: 1,
  palette: ["#224466"],
  tiles: { grass: [rows("0")] },
};
const text = (value: unknown) => JSON.stringify(value);

/** An installed Experience, its files written and hash-pinned as an install leaves them. */
function install(
  id: string,
  contents: Record<string, string>,
  mapPack: Record<string, unknown> | null,
  tamper?: string,
  minor = 72,
) {
  const root = join(dataDir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(root, { recursive: true });
  const files = { ...contents, "client.js": "x" };
  for (const [path, content] of Object.entries(files)) writeFileSync(join(root, path), content);
  if (tamper) writeFileSync(join(root, tamper), `${files[tamper]} `);
  return {
    id,
    version: "1.0.0",
    installedAt: "2026-10-02T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
    manifest: {
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id,
      name: `${id} Experience`,
      version: "1.0.0",
      description: "Map pack regression.",
      engine: { min: "2.3.0", maxExclusive: "4.0.0" },
      kind: ["agent"],
      entrypoints: { client: "client.js" },
      contributions: {
        slots: ["game-surface"],
        gameSurface: mapPack ? { setup: {}, mapPack } : {},
        ...(Object.keys(contents).length ? { assets: { paths: Object.keys(contents) } } : {}),
      },
      files: Object.entries(files).map(([path, content]) => ({
        path,
        sha256: createHash("sha256").update(content).digest("hex"),
        bytes: Buffer.byteLength(content),
      })),
      permissions: ["ui"],
      restartRequired: false,
    },
  };
}

const good = {
  "kit.worldkit.json": text(worldKitFile(kit)),
  "upriver.world.json": text(worldFile("Upriver", kit, { ...worldOf(9), edits }, story)),
  "downriver.world.json": text(worldFile("Downriver", kit, worldOf(10))),
  "tiles.tilepack.json": text(tiles),
};
const goodPack = {
  kit: "kit.worldkit.json",
  worlds: ["upriver.world.json", "downriver.world.json"],
  tiles: "tiles.tilepack.json",
};
const installed = [
  install("mapfixture", good, goodPack),
  install(
    "otherkit",
    {
      "kit.worldkit.json": text(worldKitFile(kit)),
      "stray.world.json": text(worldFile("Stray", { ...kit, label: "Another kit" }, worldOf(9))),
    },
    { kit: "kit.worldkit.json", worlds: ["stray.world.json"] },
  ),
  install(
    "tampered",
    { "kit.worldkit.json": text(worldKitFile(kit)) },
    { kit: "kit.worldkit.json" },
    "kit.worldkit.json",
  ),
  install("kitonly", { "kit.worldkit.json": text(worldKitFile(kit)) }, { kit: "kit.worldkit.json" }),
  install("plain", {}, null),
  // A world whose hand edits do not fit it reads with a note: in a pack, it is refused.
  install(
    "unfit",
    {
      "kit.worldkit.json": text(worldKitFile(kit)),
      "unfit.world.json": text(
        worldFile("Unfit", kit, {
          ...worldOf(9),
          edits: { editsVersion: 1, places: [{ id: "nowhere", name: "Nowhere" }] },
        }),
      ),
    },
    { kit: "kit.worldkit.json", worlds: ["unfit.world.json"] },
  ),
  // Larger than a share file: refused on its declared size, before the read.
  install(
    "huge",
    {
      "kit.worldkit.json": text(worldKitFile(kit)),
      "huge.world.json": `${text(worldFile("Huge", kit, worldOf(9)))}${" ".repeat(WORLD_SHARE_FILE_MAX_BYTES + 1)}`,
    },
    { kit: "kit.worldkit.json", worlds: ["huge.world.json"] },
  ),
  // Image tiles (tile pack v2) need Capability API 1.80.
  install(
    "imagetiles",
    { "kit.worldkit.json": text(worldKitFile(kit)), "tiles.tilepack.json": text(imageTilePack()) },
    { kit: "kit.worldkit.json", tiles: "tiles.tilepack.json" },
    undefined,
    80,
  ),
  // Whole as a PNG, but its pixels do not decode: refused where the Engine decodes sheets.
  install(
    "badimagetiles",
    {
      "kit.worldkit.json": text(worldKitFile(kit)),
      "tiles.tilepack.json": text(
        imageTilePack({ sheets: [{ ...imageTilePack().sheets[0]!, png: undecodablePng() }] }),
      ),
    },
    { kit: "kit.worldkit.json", tiles: "tiles.tilepack.json" },
    undefined,
    80,
  ),
  install(
    "oldimagetiles",
    { "kit.worldkit.json": text(worldKitFile(kit)), "tiles.tilepack.json": text(imageTilePack()) },
    { kit: "kit.worldkit.json", tiles: "tiles.tilepack.json" },
    undefined,
    79,
  ),
  // A story's intro message is Capability API 1.339: a pack declaring 1.338 may not carry one.
  ...[338, 339].map((minor) =>
    install(
      `intro${minor}`,
      {
        "kit.worldkit.json": text(worldKitFile(kit)),
        "upriver.world.json": text(
          worldFile(
            "Upriver",
            kit,
            { ...worldOf(9), edits },
            {
              ...story,
              intro: { mode: "defined", text: "The river is high.", locked: true },
            },
          ),
        ),
      },
      { kit: "kit.worldkit.json", worlds: ["upriver.world.json"] },
      undefined,
      minor,
    ),
  ),
  install(
    "badtiles",
    { "kit.worldkit.json": text(worldKitFile(kit)), "tiles.tilepack.json": "{}" },
    { kit: "kit.worldkit.json", tiles: "tiles.tilepack.json" },
  ),
];
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({ schemaVersion: 1, packages: installed }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { readMapPack } = await import("../../packages/server/src/services/game/map-pack.service.js");

try {
  // ── The manifest: from 1.72, its files declared ──
  const manifest = installed[0]!.manifest;
  assert.ok(capabilityPackageManifestSchema.safeParse(manifest).success, "a map pack at 1.72");
  const older = capabilityPackageManifestSchema.safeParse({ ...manifest, capabilityApi: { major: 1, minor: 71 } });
  assert.ok(!older.success && older.error.issues.some((issue) => /1\.72/.test(issue.message)));
  const undeclared = capabilityPackageManifestSchema.safeParse({
    ...manifest,
    contributions: { ...manifest.contributions, assets: { paths: ["kit.worldkit.json"] } },
  });
  assert.ok(
    !undeclared.success && undeclared.error.issues.some((issue) => /must also be declared/.test(issue.message)),
  );
  const wrongSlot = capabilityPackageManifestSchema.safeParse({
    ...manifest,
    contributions: { ...manifest.contributions, slots: ["home-browser-tab"], homeBrowserTab: { label: "x" } },
  });
  assert.ok(
    !wrongSlot.success && wrongSlot.error.issues.some((issue) => /requires the game-surface slot/.test(issue.message)),
    "only an Experience ships a map pack (its setup asks for the slot)",
  );
  const ownSetup = capabilityPackageManifestSchema.safeParse({
    ...manifest,
    contributions: { ...manifest.contributions, gameSurface: { mapPack: goodPack } },
  });
  assert.ok(!ownSetup.success && ownSetup.error.issues.some((issue) => /own setup/.test(issue.message)));

  // ── Read through the verified asset path ──
  const read = await readMapPack("mapfixture");
  assert.ok(read?.ok, JSON.stringify(read));
  assert.deepEqual(read.pack.kit, kit);
  assert.deepEqual(
    read.pack.worlds.map((world) => [world.name, world.world.seed, world.world.edits ?? null, world.story ?? null]),
    [
      ["Upriver", 9, edits, story],
      ["Downriver", 10, null, null],
    ],
  );
  assert.equal(read.pack.tiles?.name, "Riverlands tiles");
  const stray = await readMapPack("otherkit");
  assert.ok(stray && !stray.ok && /another kit/.test(stray.reason), JSON.stringify(stray));
  const tampered = await readMapPack("tampered");
  assert.ok(tampered && !tampered.ok && /integrity/i.test(tampered.reason), JSON.stringify(tampered));
  const unfit = await readMapPack("unfit");
  assert.ok(unfit && !unfit.ok && /does not fit its kit/.test(unfit.reason), JSON.stringify(unfit));
  const huge = await readMapPack("huge");
  assert.ok(
    huge && !huge.ok && /^huge\.world\.json is larger than a share file/.test(huge.reason),
    JSON.stringify(huge),
  );
  const badTiles = await readMapPack("badtiles");
  assert.ok(badTiles && !badTiles.ok && /tiles do not read/.test(badTiles.reason), JSON.stringify(badTiles));
  const imageTiles = await readMapPack("imagetiles");
  assert.ok(imageTiles?.ok && imageTiles.pack.tiles?.tilePackVersion === 2, JSON.stringify(imageTiles));
  assert.deepEqual(await readMapPack("imagetiles"), imageTiles, "read again from what was checked");
  // Only an Engine that can decode sheets (sharp) finds that out.
  const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
  if (
    await getSharp().then(
      () => true,
      () => false,
    )
  ) {
    const badImageTiles = await readMapPack("badimagetiles");
    assert.ok(
      badImageTiles && !badImageTiles.ok && /does not decode/.test(badImageTiles.reason),
      JSON.stringify(badImageTiles),
    );
  }
  const oldImageTiles = await readMapPack("oldimagetiles");
  assert.ok(
    oldImageTiles && !oldImageTiles.ok && /needs capabilityApi 1\.80/.test(oldImageTiles.reason),
    JSON.stringify(oldImageTiles),
  );
  const early = await readMapPack("intro338");
  assert.ok(early && !early.ok && /needs Capability API 1\.339/.test(early.reason), JSON.stringify(early));
  const intro = await readMapPack("intro339");
  assert.ok(intro?.ok, JSON.stringify(intro));
  assert.equal(intro.pack.worlds[0]?.story?.intro?.text, "The river is high.");
  assert.equal(await readMapPack("plain"), null, "an Experience without a pack");
  assert.equal(await readMapPack("nowhere"), null, "not installed");

  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  try {
    const served = await app.inject({ method: "GET", url: "/api/game/experience-map-pack/mapfixture" });
    assert.equal(served.json().mapPack.worlds.length, 2);
    assert.equal((await app.inject({ method: "GET", url: "/api/game/experience-map-pack/otherkit" })).statusCode, 400);
    assert.deepEqual((await app.inject({ method: "GET", url: "/api/game/experience-map-pack/plain" })).json(), {
      mapPack: null,
    });

    // ── A new game with the Experience on is locked to its pack ──
    const base = {
      genre: "Fantasy",
      setting: "A river kingdom",
      tone: "Grim",
      difficulty: "normal",
      rating: "sfw",
      playerGoals: "",
      gmMode: "standalone",
      partyCharacterIds: [],
    };
    const create = (setup: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/api/game/create",
        payload: { name: "Riverlands", setupConfig: { ...base, ...setup } },
      });
    const starter = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "cyberpunk")!);
    assert.ok(starter.ok);
    const another = await create({ gameExperienceId: "mapfixture", worldKit: starter.kit });
    assert.equal(another.statusCode, 400);
    assert.equal(another.json().code, "map_pack_locked");
    const noWorld = await create({ gameExperienceId: "mapfixture", worldKit: kit });
    assert.equal(noWorld.statusCode, 400, "a pack with maps needs one of them");
    const otherSeed = await create({ gameExperienceId: "mapfixture", worldKit: kit, world: { ...worldOf(11) } });
    assert.equal(otherSeed.statusCode, 400, "a world not among its maps");
    const noEdits = await create({ gameExperienceId: "mapfixture", worldKit: kit, world: { ...worldOf(9) } });
    assert.equal(noEdits.statusCode, 400, "its map, but without the map's hand edits");
    // The same kit and world with their keys in another order are the same.
    const reordered = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).reverse()) as T;
    const shuffled = await create({
      gameExperienceId: "mapfixture",
      worldKit: reordered(kit),
      world: reordered({ ...worldOf(10), brief: reordered(checked.brief) }),
    });
    assert.equal(shuffled.statusCode, 200, shuffled.body);
    const noStory = await create({ gameExperienceId: "mapfixture", worldKit: kit, world: { ...worldOf(9), edits } });
    assert.equal(noStory.statusCode, 400, "its map, but without the map's story");
    const made = await create({
      gameExperienceId: "mapfixture",
      worldKit: kit,
      world: { ...worldOf(9), edits },
      story,
    });
    assert.equal(made.statusCode, 200, made.body);
    const meta = JSON.parse(made.json().sessionChat.metadata);
    assert.deepEqual(meta.gameMapPack, { packageId: "mapfixture" }, "it draws with the pack's tiles");
    assert.deepEqual(meta.gameWorld.edits, edits);
    assert.deepEqual(meta.gameStory, story, "and its story");
    assert.equal(meta.gameWorldKit.id, "riverlands");
    const kitOnly = await create({ gameExperienceId: "kitonly", worldKit: kit, world: { ...worldOf(12) } });
    assert.equal(kitOnly.statusCode, 200, "a pack without maps leaves the world to the player");
    assert.deepEqual(
      JSON.parse(kitOnly.json().sessionChat.metadata).gameMapPack,
      { packageId: "kitonly" },
      "kept for what its pack brings (its tiles, creature art, music and people)",
    );
    const broken = await create({ gameExperienceId: "tampered", worldKit: kit });
    assert.equal(broken.statusCode, 400);
    assert.equal(broken.json().code, "map_pack_invalid");
    const free = await create({ gameExperienceId: "plain", worldKit: starter.kit });
    assert.equal(free.statusCode, 200, "an Experience without a pack locks nothing");
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("World map packs: an Experience's kit, maps and tiles, read verified and locked to a new game.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
