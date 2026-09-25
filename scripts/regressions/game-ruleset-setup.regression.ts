/**
 * Slice 4 of Game Mode rulesets: the Rules choice is pinned once at game creation from the
 * server's own registry, a shared setup restores it only when this install can honour it, and a
 * new game takes a COPY of each starting build. A game with no ruleset keeps exactly the setup
 * config and metadata it always had.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildGameSetupShareFile,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
} from "../../packages/client/src/lib/game-setup-share.js";
import {
  copyRulesetSheetForGame,
  createRulesetSheetEnvelope,
  parseRulesetDefinition,
  type GameSetupConfig,
  type InstalledRuleset,
} from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleBytes = readFileSync(fileURLToPath(exampleUrl));
const parsedExample = parseRulesetDefinition(JSON.parse(exampleBytes.toString("utf8")));
assert.ok(parsedExample.ok);
const fiveE = parsedExample.definition;
const installed: InstalledRuleset = { packageId: "ruleset-5e-2014", definition: fiveE };

// ── A game copies the starting build, and the copy is its own ──
{
  const stored = createRulesetSheetEnvelope(fiveE);
  stored.build.abilities.dex = 16;
  stored.build.lists.attacks = [{ name: "Shortsword" }];
  const copy = copyRulesetSheetForGame(fiveE, stored);
  assert.deepEqual(copy, stored);
  copy.build.abilities.dex = 8;
  (copy.build.lists.attacks as Array<Record<string, unknown>>)[0]!.name = "Dagger";
  assert.equal(stored.build.abilities.dex, 16, "editing the game's sheet never reaches the library's");
  assert.deepEqual(stored.build.lists.attacks, [{ name: "Shortsword" }]);

  // No sheet, or something that is not one: a blank default, never invented numbers.
  assert.deepEqual(copyRulesetSheetForGame(fiveE, undefined), createRulesetSheetEnvelope(fiveE));
  assert.deepEqual(copyRulesetSheetForGame(fiveE, "garbage"), createRulesetSheetEnvelope(fiveE));
  // A sheet saved under an older sheet version is carried forward to the current one.
  assert.equal(copyRulesetSheetForGame({ ...fiveE, sheet: { ...fiveE.sheet, version: 4 } }, stored).v, 4);
}

// ── Setup sharing ──
const baseConfig = {
  genre: "Fantasy",
  setting: "A quiet harbor",
  tone: "Hopeful",
  difficulty: "normal",
  rating: "sfw",
  playerGoals: "Find my lost friend",
  gmMode: "standalone",
  partyCharacterIds: [],
} as unknown as GameSetupConfig;
const pin = { id: "5e-2014", version: 1, packageId: "ruleset-5e-2014", options: {} };
{
  const file = parseGameSetupShareFileJson(
    JSON.stringify(
      buildGameSetupShareFile({
        gameName: "Rules",
        config: { ...baseConfig, ruleset: pin },
        labels: { rulesetName: "5e (SRD 5.1)" },
      }),
    ),
  );
  assert.equal(file.setup.labels?.rulesetName, "5e (SRD 5.1)", "a shared setup can name a ruleset the recipient lacks");
  const resources = { characters: [], connections: [], lorebooks: [], personas: [], promptPresets: [] };

  assert.deepEqual(resolveGameSetupImport(file, { ...resources, installedRulesets: [installed] }).config.ruleset, pin);
  assert.equal(resolveGameSetupImport(file, resources).config.ruleset, undefined, "not installed: own rules");
  assert.equal(
    resolveGameSetupImport(file, { ...resources, installedRulesets: [installed], isNewGame: false }).config.ruleset,
    undefined,
    "a ruleset is only ever chosen for a new game",
  );
  const newer = { packageId: "ruleset-5e-2014", definition: { ...fiveE, version: 3 } };
  assert.equal(
    resolveGameSetupImport(file, { ...resources, installedRulesets: [newer] }).config.ruleset?.version,
    3,
    "a newer installed version is accepted, and the pin names what is installed",
  );
  file.setup.config.ruleset = { ...pin, version: 2 };
  assert.equal(
    resolveGameSetupImport(file, { ...resources, installedRulesets: [installed] }).config.ruleset,
    undefined,
    "an older installed version cannot honour the shared setup",
  );

  // A shared file is untrusted: a pin that is not one refuses the file.
  const tampered = JSON.parse(JSON.stringify(buildGameSetupShareFile({ gameName: "Bad", config: baseConfig })));
  tampered.setup.config.ruleset = { id: "../escape", version: 1 };
  assert.throws(() => parseGameSetupShareFileJson(JSON.stringify(tampered)));

  const plain = parseGameSetupShareFileJson(
    JSON.stringify(buildGameSetupShareFile({ gameName: "Plain", config: baseConfig })),
  );
  assert.equal(
    "ruleset" in resolveGameSetupImport(plain, { ...resources, installedRulesets: [installed] }).config,
    false,
    "a setup with no ruleset gains no key",
  );
}

// ── Creation pins from the registry ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-setup-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

// A really installed package: the registry record plus the hash-pinned asset on disk.
const manifest = {
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
const packageDir = join(dataDir, "capability-packages", "versions", manifest.id, manifest.version);
mkdirSync(packageDir, { recursive: true });
writeFileSync(join(packageDir, "ruleset.json"), exampleBytes);
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: manifest.id,
        version: manifest.version,
        manifest,
        installedAt: "2026-09-18T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
      },
    ],
  }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { applyGeneratedGameCharacterCards, gameRoutes } =
  await import("../../packages/server/src/routes/game.routes.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
try {
  const create = (setupConfig: Record<string, unknown>) =>
    app.inject({ method: "POST", url: "/api/game/create", payload: { name: "Ruleset setup", setupConfig } });

  // The client's version and package are not trusted: the pin is rebuilt from what is installed.
  const pinned = await create({ ...baseConfig, ruleset: { id: "5e-2014", version: 99, packageId: "someone-else" } });
  assert.equal(pinned.statusCode, 200, pinned.body);
  const pinnedMeta = JSON.parse(pinned.json().sessionChat.metadata);
  assert.deepEqual(pinnedMeta.gameRuleset, pin);
  assert.deepEqual(pinnedMeta.gameSetupConfig.ruleset, pin);
  assert.deepEqual(pinnedMeta.gameInitialSetup.config.ruleset, pin, "the saved setup can show and share the choice");

  // A ruleset this install lacks is refused, never swapped for other rules behind the player's back.
  const missing = await create({ ...baseConfig, ruleset: { id: "v20", version: 1 } });
  assert.equal(missing.statusCode, 400, missing.body);
  assert.equal(missing.json().code, "ruleset_not_installed");

  // No ruleset: exactly the metadata a game has always had.
  const legacy = await create(baseConfig as unknown as Record<string, unknown>);
  assert.equal(legacy.statusCode, 200, legacy.body);
  const legacyMeta = JSON.parse(legacy.json().sessionChat.metadata);
  assert.equal("gameRuleset" in legacyMeta, false);
  assert.equal("ruleset" in legacyMeta.gameSetupConfig, false);

  // ── Setup copies each member's starting build into the game, and only into the game ──
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const characters = createCharactersStorage(db);
  const starting = createRulesetSheetEnvelope(fiveE);
  starting.build.abilities.dex = 16;
  const blankCard = {
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    tags: [],
    creator: "",
    character_version: "",
    alternate_greetings: [],
  };
  const withSheet = await characters.create({
    ...blankCard,
    name: "Mira",
    extensions: { rulesetSheets: { "5e-2014": starting, "Kenhito/v20": { v: 1, build: {} } } },
  } as never);
  const withoutSheet = await characters.create({ ...blankCard, name: "Tam the Bold", extensions: {} } as never);
  assert.ok(withSheet?.id && withoutSheet?.id);

  const party = await create({
    ...baseConfig,
    partyCharacterIds: [withSheet.id, withoutSheet.id],
    ruleset: { id: "5e-2014", version: 1 },
  });
  assert.equal(party.statusCode, 200, party.body);
  const partyChatId = party.json().sessionChat.id as string;
  const applied = await app.inject({
    method: "POST",
    url: "/api/game/setup/apply-json",
    payload: {
      chatId: partyChatId,
      rawJson: JSON.stringify({
        storyArc: "An arc.",
        worldOverview: "A harbor town.",
        plotTwists: ["A twist."],
        startingNpcs: [{ name: "Harbormaster" }],
        characterCards: [{ name: "mira" }, { name: "Tam the Bold" }],
      }),
    },
  });
  assert.equal(applied.statusCode, 200, applied.body);
  const partyChat = await createChatsStorage(db).getById(partyChatId);
  const partyMeta = JSON.parse(partyChat!.metadata as string);
  const cards = partyMeta.gameCharacterCards as Array<{
    name: string;
    rulesetSheet?: { v: number; build: { abilities: Record<string, number> } };
  }>;
  assert.equal(cards.length, 2);
  assert.equal(
    cards[0]!.rulesetSheet?.build.abilities.dex,
    16,
    "the stored build is copied, matched by normalized name",
  );
  assert.deepEqual(
    cards[1]!.rulesetSheet,
    createRulesetSheetEnvelope(fiveE),
    "no stored sheet: a blank one, never invented",
  );
  assert.equal("Kenhito/v20" in (cards[0] as Record<string, unknown>), false);
  // The library card is what it was.
  const library = await characters.getById(withSheet.id);
  const libraryData = typeof library!.data === "string" ? JSON.parse(library!.data) : library!.data;
  assert.deepEqual(libraryData.extensions.rulesetSheets["5e-2014"], starting);

  // ── After setup, nothing that rewrites a card may cost it the game's sheet ──
  // A session conclusion rebuilds the cards it names from an allow-list.
  {
    const concluded = applyGeneratedGameCharacterCards(cards as unknown as Array<Record<string, unknown>>, [
      { name: "MIRA", shortDescription: "Older and wiser.", class: "Rogue" },
    ]);
    assert.equal(concluded.updatedCount, 1);
    assert.equal(concluded.cards[0]!.shortDescription, "Older and wiser.");
    assert.deepEqual(concluded.cards[0]!.rulesetSheet, cards[0]!.rulesetSheet, "a concluded card keeps its sheet");
    assert.deepEqual(concluded.cards[1], cards[1], "a card the conclusion does not name is untouched");
  }

  // A recruit joins the way the party did: a copy of the library build, or a blank sheet. No model
  // connection exists here, so the route takes its fallback card, which is the path under test.
  {
    const recruitBuild = createRulesetSheetEnvelope(fiveE);
    recruitBuild.build.abilities.str = 17;
    const recruitCard = await characters.create({
      ...blankCard,
      name: "Bram Ironhand",
      extensions: { rulesetSheets: { "5e-2014": recruitBuild } },
    } as never);
    assert.ok(recruitCard?.id);
    const recruited = await app.inject({
      method: "POST",
      url: "/api/game/party/recruit",
      payload: { chatId: partyChatId, characterName: "Bram Ironhand" },
    });
    assert.equal(recruited.statusCode, 200, recruited.body);
    const afterRecruit = JSON.parse((await createChatsStorage(db).getById(partyChatId))!.metadata as string);
    const recruitedCards = afterRecruit.gameCharacterCards as typeof cards;
    const bram = recruitedCards.find((card) => card.name === "Bram Ironhand");
    assert.equal(bram?.rulesetSheet?.build.abilities.str, 17, "a recruit gets a copy of the library build");
    assert.equal(recruitedCards[0]!.rulesetSheet?.build.abilities.dex, 16, "recruiting leaves the others alone");
  }

  // A game with no ruleset gets no sheets.
  const plainGame = await create({ ...baseConfig, partyCharacterIds: [withSheet.id] } as unknown as Record<
    string,
    unknown
  >);
  const plainApplied = await app.inject({
    method: "POST",
    url: "/api/game/setup/apply-json",
    payload: {
      chatId: plainGame.json().sessionChat.id,
      rawJson: JSON.stringify({
        storyArc: "An arc.",
        worldOverview: "A harbor town.",
        plotTwists: ["A twist."],
        startingNpcs: [{ name: "Harbormaster" }],
        characterCards: [{ name: "Mira" }],
      }),
    },
  });
  assert.equal(plainApplied.statusCode, 200, plainApplied.body);
  const plainChat = await createChatsStorage(db).getById(plainGame.json().sessionChat.id);
  const plainCards = JSON.parse(plainChat!.metadata as string).gameCharacterCards as Array<Record<string, unknown>>;
  assert.equal("rulesetSheet" in plainCards[0]!, false);

  console.info("game ruleset setup regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
