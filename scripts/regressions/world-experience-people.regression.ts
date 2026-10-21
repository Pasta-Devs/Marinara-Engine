/**
 * An Experience's people and companions (Capability API 1.346, 1.347), with its music (1.345).
 *
 *   - A map pack may ship a `.people.json` file (1.346): named people of its worlds with a portrait,
 *     expressions, a walking look from its tiles, a description, a voice and lore. It is read strictly:
 *     each person is a named person of one of its worlds, each picture one of its assets, each walking look
 *     one of its tiles' characters.
 *   - A game of the Experience gets a lorebook of its people, active from the first turn; a person the game
 *     meets comes with their portrait.
 *   - A person may be a companion (1.347): a build per level for each ruleset. The story recruits and
 *     dismisses them, the Game Master may take only them in, and one who joins plays by the build for the
 *     party's highest level, rising with the party and never lowered.
 *   - Its creature packs (1.344): read with the pack, for its fights' art.
 *   - Its music (1.345): a place's track, else the nearest place's above it, else the default; a story cue
 *     wins while it holds.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  capabilityPackageManifestSchema,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createRulesetSheetEnvelope,
  experienceCompanionBuild,
  experienceCompanionsPromptText,
  experienceDressedNpc,
  experiencePeopleLore,
  experienceTrackHere,
  parseRulesetDefinition,
  parseWorldKit,
  readExperiencePeople,
  storyCapabilityMinor,
  storyTurn,
  worldCast,
  worldFile,
  worldKitFile,
  worldPersonNpc,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";
import { imageTilePack, pngBytes, pngDataUrl } from "./fixtures/image-tile-pack.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-experience-people-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

const exampleBytes = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
);
const parsedRuleset = parseRulesetDefinition(JSON.parse(exampleBytes.toString("utf8")));
assert.ok(parsedRuleset.ok);
const fiveE = parsedRuleset.definition;

// ── A world with named people ──
const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
const kit = { ...parsedKit.kit, id: "valley", label: "Valley kit" };
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const checked = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A valley held at harvest",
  places: [{ name: "Thrushwick", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
  peopleNames: kit.cultures.map((culture) => ({
    culture: culture.id,
    given: ["Ama", "Tobin", "Hesk", "Mira", "Elara", "Oswin", "Bryn", "Cato", "Tamsin", "Wren", "Edda", "Fenn"],
    family: ["Arnwald", "Fennick", "Holt", "Marrow", "Voss", "Drey", "Callow"],
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
const [elder, healer, stranger] = worldCast(game, thrushwick.id).filter((person) => person.named);
assert.ok(elder && healer && stranger, "three named people in Thrushwick");

// ── The people file ──
const level = (at: number) => ({
  at,
  build: {
    abilities: { wis: 14 + at },
    skills: {},
    saves: {},
    bonuses: {},
    fields: { level: at },
    lists: {},
  },
});
const peopleFile = {
  peopleVersion: 1,
  people: [
    {
      person: elder.id,
      portrait: "people/elder.png",
      expressions: { happy: "people/elder-happy.png" },
      sprite: "elder-walk",
      description: "Keeper of the valley's bells.",
      voice: "Slow, and fond of proverbs.",
      lore: [{ keys: ["bells"], content: "The bells ring the year out." }],
    },
    {
      person: healer.id,
      portrait: "people/healer.png",
      description: "A hedge healer who walks the valley's roads.",
      companion: { role: "Healing", sheets: { "5e-2014": { level: ["level"], builds: [level(1), level(3)] } } },
    },
  ],
  lore: [{ name: "The Held Autumn", keys: ["autumn"], content: "The year has not turned in a long time." }],
};
const people = readExperiencePeople(JSON.stringify(peopleFile));
assert.ok(people.ok, JSON.stringify(people));
const refused = (patch: unknown, issue: RegExp) => {
  const result = readExperiencePeople(JSON.stringify(patch));
  assert.ok(!result.ok && result.issues.some((each) => issue.test(each)), JSON.stringify(result));
};
refused({ ...peopleFile, people: [peopleFile.people[0], peopleFile.people[0]] }, /dressed twice/);
refused(
  {
    ...peopleFile,
    people: [
      {
        person: healer.id,
        companion: { sheets: { "5e-2014": { level: ["level"], builds: [level(3), level(1)] } } },
      },
    ],
  },
  /each for a higher level/,
);
refused(
  {
    ...peopleFile,
    people: [
      {
        person: healer.id,
        companion: {
          sheets: { "5e-2014": { level: ["level"], builds: [{ at: 2, build: level(1).build }] } },
        },
      },
    ],
  },
  /does not say level 2/,
);
refused({ ...peopleFile, people: [{ person: "Not an id" }] }, /person id/);

// Lore: one entry per person with something to say, by their name, and the Experience's own.
const lore = experiencePeopleLore(game, people.people);
assert.deepEqual(
  lore.map((entry) => [entry.name, entry.keys]),
  [
    [elder.name, [elder.name]],
    [`${elder.name} (1)`, ["bells"]],
    [healer.name, [healer.name]],
    ["The Held Autumn", ["autumn"]],
  ],
);
assert.match(lore[0]!.content, /How .+ speaks: Slow/);

// A met person comes dressed.
const urls = {
  "people/elder.png": "/elder.png",
  "people/elder-happy.png": "/elder-happy.png",
  "people/healer.png": "/healer.png",
};
const dressed = experienceDressedNpc(worldPersonNpc(game, elder), { ...people.people, urls });
assert.equal(dressed.avatarUrl, "/elder.png");
assert.match(dressed.description, /^Keeper of the valley's bells\.\n\n/);
const plain = worldPersonNpc(game, stranger);
assert.deepEqual(experienceDressedNpc(plain, { ...people.people, urls }), plain, "one the file does not dress");

// The build for the party's level: the highest reached, else the lowest.
const sheet = people.people.people[1]!.companion!.sheets["5e-2014"]!;
assert.equal(experienceCompanionBuild(sheet, 0).at, 1);
assert.equal(experienceCompanionBuild(sheet, 2).at, 1);
assert.equal(experienceCompanionBuild(sheet, 7).at, 3);

// The Game Master hears who may join.
const told = experienceCompanionsPromptText(game, people.people, []);
assert.match(told, /Only they may join the party/);
assert.ok(told.includes(`- ${healer.name} (at Thrushwick): Healing`), told);
assert.ok(!told.includes(elder.name), "only companions");
assert.ok(experienceCompanionsPromptText(game, people.people, [healer.name]).includes("travelling with the party"));

// ── The story recruits and dismisses them (1.347) ──
const storyInput: StoryScriptInput = {
  storyVersion: 1,
  events: [
    { id: "join", when: { on: "turn", turn: 1 }, do: [{ recruit: healer.id }, { music: "dirge" }] },
    { id: "part", when: { on: "turn", turn: 2 }, do: [{ dismiss: healer.id }] },
  ],
};
const parsedStory = checkStoryScript(game, storyInput);
assert.ok(parsedStory.ok, JSON.stringify(parsedStory));
const story = parsedStory.story;
assert.equal(storyCapabilityMinor(story), 347);
const nobody = checkStoryScript(game, {
  storyVersion: 1,
  events: [{ id: "x", when: { on: "start" }, do: [{ recruit: "zz-9" }] }],
});
assert.ok(!nobody.ok && nobody.issues.some((issue) => /no person "zz-9"/.test(issue)), JSON.stringify(nobody));
const turn = (replies: string[]) =>
  storyTurn(story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
  });
const first = turn([]);
assert.ok(first.prepend.includes(`[party_change: character="${healer.name}" change="add"]`), first.prepend);
assert.ok(
  first.tells.some((tell) => tell.includes(`${healer.name} joins the party now`)),
  JSON.stringify(first.tells),
);
const second = turn([`${first.prepend}They set out.`]);
assert.ok(second.prepend.includes(`[party_change: character="${healer.name}" change="remove"]`), second.prepend);

// ── Its music (1.345) ──
const music = {
  tracks: [
    { id: "valley", path: "music/valley.ogg" },
    { id: "town", path: "music/town.ogg" },
    { id: "dirge", path: "music/dirge.ogg" },
  ],
  default: "valley",
  combat: "dirge",
  places: [{ place: thrushwick.id, track: "town" }],
};
assert.equal(experienceTrackHere(music, game, thrushwick.id, undefined), "town");
assert.equal(experienceTrackHere(music, game, "elsewhere", undefined), "valley");
assert.equal(experienceTrackHere(music, game, thrushwick.id, "dirge"), "dirge", "a cue wins");

// ── Installed: read whole and checked ──
const text = (value: unknown) => JSON.stringify(value);
const png = "png";
function install(
  id: string,
  contents: Record<string, string>,
  mapPack: Record<string, unknown>,
  minor = 347,
  extraAssets: string[] = [],
) {
  const root = join(dataDir, "capability-packages", "versions", id, "1.0.0");
  mkdirSync(join(root, "people"), { recursive: true });
  mkdirSync(join(root, "music"), { recursive: true });
  mkdirSync(join(root, "creatures"), { recursive: true });
  const files = { ...contents, "client.js": "x" };
  for (const [path, content] of Object.entries(files)) writeFileSync(join(root, path), content);
  return {
    id,
    version: "1.0.0",
    installedAt: "2026-10-11T00:00:00.000Z",
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
      description: "Experience people regression.",
      engine: { min: "2.3.0", maxExclusive: "4.0.0" },
      kind: ["agent"],
      entrypoints: { client: "client.js" },
      contributions: {
        slots: ["game-surface"],
        gameSurface: { setup: {}, mapPack },
        assets: { paths: [...Object.keys(contents), ...extraAssets] },
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
const tiles = imageTilePack();
// A walking block: three frames of one cell by two, four facings.
const walk = pngBytes(144, 384, () => [120, 90, 60, 255]);
const tilesWithElder = {
  ...tiles,
  sheets: [...tiles.sheets, { id: "folk", png: pngDataUrl(walk), width: 144, height: 384 }],
  characters: [{ id: "elder-walk", sheet: "folk", x: 0, y: 0 }],
};
const creaturePack = {
  creaturePackVersion: 1,
  id: "valley-creatures",
  name: "Valley creatures",
  version: 1,
  tileSize: 48,
  sheets: [{ id: "s1", png: pngDataUrl(pngBytes(48, 384, () => [90, 90, 90, 255])), width: 48, height: 384 }],
  creatures: [
    {
      id: "scarecrow",
      match: ["5e-2014/creatures/scarecrow", "scarecrow"],
      size: "medium",
      w: 1,
      h: 2,
      frames: 1,
      variants: [{ sheet: "s1", x: 0, y: 0 }],
    },
  ],
};
const contents = (patch: Record<string, string> = {}) => ({
  "kit.worldkit.json": text(worldKitFile(kit)),
  "valley.world.json": text(worldFile("Valley", kit, stored, story)),
  "tiles.tilepack.json": text(tilesWithElder),
  "people/valley.people.json": text(peopleFile),
  "people/elder.png": png,
  "people/elder-happy.png": png,
  "people/healer.png": png,
  "music/valley.ogg": "ogg",
  "music/town.ogg": "ogg",
  "music/dirge.ogg": "ogg",
  "creatures/valley.creaturepack.json": text(creaturePack),
  ...patch,
});
const pack = {
  kit: "kit.worldkit.json",
  worlds: ["valley.world.json"],
  tiles: "tiles.tilepack.json",
  people: "people/valley.people.json",
  music,
  creatures: ["creatures/valley.creaturepack.json"],
};
const peopleOf = (file: unknown) => ({ "people/valley.people.json": text(file) });
const rulesetManifest = {
  schemaVersion: 2,
  capabilityApi: { major: 1, minor: 20 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  id: "ruleset-5e-2014",
  name: "5e (SRD 5.1)",
  version: "0.1.0",
  description: "5e rules for Game Mode.",
  engine: { min: "2.4.6", maxExclusive: "4.0.0" },
  kind: ["ruleset"],
  entrypoints: {},
  contributions: { assets: { paths: ["ruleset.json"] } },
  files: [
    {
      path: "ruleset.json",
      sha256: createHash("sha256").update(exampleBytes).digest("hex"),
      bytes: exampleBytes.length,
    },
  ],
  permissions: [],
  restartRequired: false,
};
mkdirSync(join(dataDir, "capability-packages", "versions", rulesetManifest.id, rulesetManifest.version), {
  recursive: true,
});
writeFileSync(
  join(dataDir, "capability-packages", "versions", rulesetManifest.id, rulesetManifest.version, "ruleset.json"),
  exampleBytes,
);
const strayStory = checkStoryScript(game, {
  storyVersion: 1,
  events: [{ id: "x", when: { on: "start" }, do: [{ recruit: elder.id }, { music: "dirge" }] }],
});
assert.ok(strayStory.ok);
const installed = [
  install("peoplefix", contents(), pack),
  install("oldpeople", contents(), pack, 346),
  install(
    "oldpeoplenocompanions",
    contents({
      ...peopleOf({ ...peopleFile, people: [peopleFile.people[0]] }),
      "valley.world.json": text(worldFile("Valley", kit, stored)),
    }),
    pack,
    346,
  ),
  install("nobody", contents(peopleOf({ ...peopleFile, people: [{ person: `${thrushwick.id}-999` }] })), pack),
  install(
    "undeclared",
    contents(peopleOf({ ...peopleFile, people: [{ ...peopleFile.people[0], portrait: "people/missing.png" }] })),
    pack,
  ),
  install(
    "nosprite",
    contents(peopleOf({ ...peopleFile, people: [{ ...peopleFile.people[0], sprite: "nobody-walk" }] })),
    pack,
  ),
  install(
    "notacompanion",
    contents({ "valley.world.json": text(worldFile("Valley", kit, stored, strayStory.story)) }),
    pack,
  ),
  {
    id: rulesetManifest.id,
    version: rulesetManifest.version,
    manifest: rulesetManifest,
    installedAt: "2026-10-11T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  },
];
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({ schemaVersion: 1, packages: installed }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { readMapPack, readMapPackPeople } = await import("../../packages/server/src/services/game/map-pack.service.js");
const { syncCompanionSheets } =
  await import("../../packages/server/src/services/game/experience-companions.service.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");

try {
  // ── The manifest: people need 1.346 ──
  const manifest = installed[0]!.manifest;
  assert.ok(
    capabilityPackageManifestSchema.safeParse(manifest).success,
    JSON.stringify(capabilityPackageManifestSchema.safeParse(manifest).error?.issues),
  );
  const older = capabilityPackageManifestSchema.safeParse({ ...manifest, capabilityApi: { major: 1, minor: 345 } });
  assert.ok(
    !older.success && older.error.issues.some((issue) => /people require capabilityApi 1\.346/.test(issue.message)),
  );

  // ── Read whole ──
  const read = await readMapPack("peoplefix");
  assert.ok(read?.ok, JSON.stringify(read));
  assert.equal(read.pack.people?.people.length, 2);
  assert.match(
    read.pack.people!.urls["people/elder.png"]!,
    /\/api\/capability-packages\/peoplefix\/assets\/people\/elder\.png\?v=1\.0\.0$/,
  );
  assert.match(read.pack.music!.urls.town!, /music\/town\.ogg/);
  assert.deepEqual(
    read.pack.creatures?.map((each) => each.id),
    ["valley-creatures"],
    "its creature art",
  );
  const alone = await readMapPackPeople("peoplefix");
  assert.deepEqual(alone, read.pack.people, "read alone as the pack reads it");
  const why = async (id: string, reason: RegExp) => {
    const result = await readMapPack(id);
    assert.ok(result && !result.ok && reason.test(result.reason), `${id}: ${JSON.stringify(result)}`);
  };
  await why("oldpeople", /needs? capabilityApi 1\.347/);
  const older354 = await readMapPack("oldpeoplenocompanions");
  assert.ok(older354?.ok, `people without companions read at 1.346: ${JSON.stringify(older354)}`);
  await why("nobody", /none of its worlds has by name/);
  await why("undeclared", /people\/missing\.png is not one of its assets/);
  await why("nosprite", /no character for/);
  await why("notacompanion", /is not one of its companions/);

  // ── Checked before export (1.350), as an installed pack is read ──
  {
    const checkApp = Fastify();
    checkApp.decorate("db", await getDB());
    await checkApp.register(gameRoutes, { prefix: "/api/game" });
    const all = contents();
    const json = Object.fromEntries(
      Object.entries(all)
        .filter(([path]) => path.endsWith(".json"))
        .map(([path, value]) => [path, JSON.parse(value)]),
    );
    const assets = Object.entries(all)
      .filter(([path]) => !path.endsWith(".json"))
      .map(([path, value]) => ({ path, bytes: Buffer.byteLength(value) }));
    const check = (payload: unknown) =>
      checkApp.inject({ method: "POST", url: "/api/game/experience/check", payload: payload as object });
    const good = await check({ mapPack: pack, files: json, assets });
    assert.equal(good.statusCode, 200, good.body);
    assert.deepEqual(good.json(), { ok: true, minor: 347, issues: [] });
    const noPicture = await check({
      mapPack: pack,
      files: json,
      assets: assets.filter((asset) => asset.path !== "people/healer.png"),
    });
    assert.equal(noPicture.json().ok, false);
    assert.ok(
      noPicture
        .json()
        .issues.some((issue: { message: string }) =>
          /people\/healer\.png is not one of its assets/.test(issue.message),
        ),
      noPicture.body,
    );
    const { ["people/valley.people.json"]: _people, ...withoutPeople } = json;
    const unsent = await check({ mapPack: pack, files: withoutPeople, assets });
    assert.deepEqual(unsent.json().issues, [
      { path: "people/valley.people.json", message: "people/valley.people.json was not sent" },
    ]);
    const stray = await check({ mapPack: { ...pack, music: { ...music, default: "nope" } }, files: json, assets });
    assert.ok(
      stray
        .json()
        .issues.some(
          (issue: { path: string; message: string }) =>
            issue.path === "mapPack.music.default" && /No track "nope"/.test(issue.message),
        ),
      stray.body,
    );
    assert.equal((await check({ mapPack: pack })).statusCode, 400);
    await checkApp.close();
  }

  // ── A game of it ──
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRoutes, { prefix: "/api/game" });
  try {
    const made = await app.inject({
      method: "POST",
      url: "/api/game/create",
      payload: {
        name: "The Valley",
        setupConfig: {
          genre: "Fantasy",
          setting: "A valley",
          tone: "Grim",
          difficulty: "normal",
          rating: "sfw",
          playerGoals: "",
          gmMode: "standalone",
          partyCharacterIds: [],
          gameExperienceId: "peoplefix",
          worldKit: kit,
          world: { ...stored },
          story,
          ruleset: { id: "5e-2014", version: 1 },
        },
      },
    });
    assert.equal(made.statusCode, 200, made.body);
    const chatId = made.json().sessionChat.id as string;
    const meta = JSON.parse(made.json().sessionChat.metadata);
    assert.deepEqual(meta.gameMapPack, { packageId: "peoplefix" });
    assert.equal(meta.activeLorebookIds.length, 1, "its people's lorebook, active");
    const entries = (await createLorebooksStorage(db).listEntries(meta.activeLorebookIds[0])) as Array<{
      name: string;
      keys: string[];
    }>;
    assert.deepEqual(entries.map((entry) => entry.name).sort(), lore.map((entry) => entry.name).sort());

    // The party's own: Mira, at level 3.
    const chats = createChatsStorage(db);
    const mira = createRulesetSheetEnvelope(fiveE);
    mira.build.fields.level = 3;
    await chats.patchMetadata(chatId, () => ({ gameCharacterCards: [{ name: "Mira", rulesetSheet: mira }] }));
    const recruit = (characterName: string) =>
      app.inject({ method: "POST", url: "/api/game/party/recruit", payload: { chatId, characterName } });

    // Only a companion may join; the healer joins at the party's level, with their own build.
    const turnedAway = await recruit(stranger.name);
    assert.ok(turnedAway.statusCode >= 400, turnedAway.body);
    const joined = await recruit(healer.name.toUpperCase());
    assert.equal(joined.statusCode, 200, joined.body);
    const afterJoin = JSON.parse((await chats.getById(chatId))!.metadata as string);
    const card = (afterJoin.gameCharacterCards as Array<{ name: string; rulesetSheet?: { build: any } }>).find(
      (each) => each.name === healer.name,
    );
    assert.equal(card?.rulesetSheet?.build.fields.level, 3, JSON.stringify(card));
    assert.equal(card?.rulesetSheet?.build.abilities.wis, 17);
    assert.ok(
      afterJoin.gamePartyCharacterIds.some((id: string) => id.startsWith("npc:")),
      "in the party",
    );
    const tracked = (afterJoin.gameNpcs as Array<{ name: string; worldId?: string; avatarUrl?: string }>).find(
      (npc) => npc.name === healer.name,
    );
    assert.equal(tracked?.worldId, healer.id);
    assert.match(tracked?.avatarUrl ?? "", /people\/healer\.png/, "with their portrait");

    // Behind the party (a sheet set back), the next turn brings them up; never lowered.
    await chats.patchMetadata(chatId, (current) => ({
      gameCharacterCards: (current.gameCharacterCards as Array<Record<string, unknown>>).map((each) =>
        each.name === healer.name ? { ...each, rulesetSheet: { v: 1, build: level(1).build } } : each,
      ),
    }));
    await syncCompanionSheets(db, chatId, afterJoin);
    const synced = JSON.parse((await chats.getById(chatId))!.metadata as string);
    const risen = (synced.gameCharacterCards as Array<{ name: string; rulesetSheet?: { build: any } }>).find(
      (each) => each.name === healer.name,
    );
    assert.equal(risen?.rulesetSheet?.build.fields.level, 3, "risen with the party");
    await chats.patchMetadata(chatId, (current) => ({
      gameCharacterCards: (current.gameCharacterCards as Array<Record<string, unknown>>).map((each) =>
        each.name === healer.name
          ? { ...each, rulesetSheet: { v: 1, build: { ...level(3).build, fields: { level: 5 } } } }
          : each,
      ),
    }));
    await syncCompanionSheets(db, chatId, afterJoin);
    const kept = JSON.parse((await chats.getById(chatId))!.metadata as string);
    assert.equal(
      (kept.gameCharacterCards as Array<{ name: string; rulesetSheet?: { build: any } }>).find(
        (each) => each.name === healer.name,
      )?.rulesetSheet?.build.fields.level,
      5,
      "a sheet raised past its build is left alone",
    );
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("Experience people: dressed, known as lore, and companions who join and keep up with the party.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
