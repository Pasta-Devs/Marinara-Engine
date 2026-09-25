import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildExperienceSetup, parseExperienceSeed } from "../../packages/client/src/lib/game-experience-setup.js";
import {
  buildGameSetupShareFile,
  parseGameSetupShareFileJson,
  resolveGameSetupImport,
} from "../../packages/client/src/lib/game-setup-share.js";
import type { InstalledCapabilityPackage, GameSetupConfig } from "../../packages/shared/src/index.js";

const experience = {
  id: "test-experience",
  manifest: {
    name: "Test Experience",
    contributions: {
      gameSurface: {
        setup: {
          seed: { key: "worldSeed" },
          config: { generate: true },
          requires: { enableCustomWidgets: false },
        },
      },
    },
  },
} as InstalledCapabilityPackage;
for (const value of ["", " ", "oops", NaN, Infinity, null, {}, true]) assert.equal(parseExperienceSeed(value), null);
for (const value of [0, 42]) assert.equal(parseExperienceSeed(String(value)), value);
assert.equal(parseExperienceSeed("-12.5"), null, "Seeds are unsigned whole numbers");
assert.deepEqual(buildExperienceSetup(experience, "42", true), {
  gameExperienceId: experience.id,
  experienceConfig: { generate: true, worldSeed: 42 },
});
assert.deepEqual(buildExperienceSetup(experience, "42", false), {}, "Existing chats must not receive clearing keys");
assert.deepEqual(buildExperienceSetup(null, "42", true), {}, "Classic wizard omits Experience fields");

const dataDir = mkdtempSync(join(tmpdir(), "marinara-experience-config-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
const setupConfig = {
  genre: "Fantasy",
  setting: "A long campaign. ".repeat(3000),
  tone: "Hopeful",
  difficulty: "normal",
  gmMode: "standalone",
  partyCharacterIds: [],
  gameExperienceId: "test-experience",
};
try {
  const importedSource = {
    ...setupConfig,
    setting: "A quiet harbor",
    rating: "sfw",
    playerGoals: "Find my lost friend",
    experienceConfig: {
      worldSeed: 0,
      stalePackageState: { ignored: true },
      generate: false,
    },
    activeLorebookEntryIds: ["selected-entry"],
  } as GameSetupConfig;
  const file = parseGameSetupShareFileJson(
    JSON.stringify(
      buildGameSetupShareFile({
        gameName: "Test",
        config: importedSource,
        labels: { experienceName: "Test Experience", experienceSeedKey: "worldSeed" },
      }),
    ),
  );
  const resources = {
    characters: [],
    connections: [],
    lorebooks: [],
    personas: [],
    promptPresets: [],
    experiencePackages: [experience],
  };
  const imported = resolveGameSetupImport(file, resources);
  assert.deepEqual(imported.config.experienceConfig, { worldSeed: 0 }, "Imports restore only the numeric seed");
  assert.equal(imported.config.gameExperienceId, experience.id);
  const legacyExperience = {
    ...experience,
    manifest: { ...experience.manifest, contributions: { gameSurface: {} } },
  } as InstalledCapabilityPackage;
  const legacyImport = resolveGameSetupImport(file, { ...resources, experiencePackages: [legacyExperience] });
  assert.equal(legacyImport.config.gameExperienceId, experience.id, "Installed legacy Experiences remain selectable");
  assert.deepEqual(legacyImport.config.experienceConfig, {}, "Legacy imports do not restore arbitrary package state");
  assert.equal(file.setup.labels?.experienceSeedKey, "worldSeed");
  assert.equal(resolveGameSetupImport(file, { ...resources, isNewGame: false }).config.gameExperienceId, undefined);
  assert.equal(
    resolveGameSetupImport(file, { ...resources, experiencePackages: [] }).config.experienceConfig,
    undefined,
  );
  for (const seed of ["42", null, {}]) {
    file.setup.config.experienceConfig = { worldSeed: seed };
    assert.deepEqual(
      resolveGameSetupImport(file, resources).config.experienceConfig,
      {},
      "Only numeric imported seeds are restored",
    );
  }
  const inline = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: {
      name: "Inline setup",
      setupConfig: { ...importedSource, ...buildExperienceSetup(experience, "42", true) },
    },
  });
  assert.equal(inline.statusCode, 200, inline.body);
  const inlineMeta = JSON.parse(inline.json().sessionChat.metadata);
  assert.equal(inlineMeta.gameExperienceId, experience.id);
  assert.deepEqual(inlineMeta.gameSetupConfig.experienceConfig, { worldSeed: 42, generate: true });
  assert.deepEqual(inlineMeta.gameSetupConfig.activeLorebookEntryIds, ["selected-entry"]);
  assert.equal(inlineMeta.gameSetupConfig.playerGoals, "Find my lost friend");

  for (const experienceConfig of [{ world: "Detailed map. ".repeat(4000) }, setupConfig]) {
    const response = await app.inject({
      method: "POST",
      url: "/api/game/create",
      payload: { name: "Experience config regression", setupConfig: { ...setupConfig, experienceConfig } },
    });
    assert.equal(response.statusCode, 200, response.body);
    const metadata = JSON.parse(response.json().sessionChat.metadata);
    assert.deepEqual(metadata.gameSetupConfig.experienceConfig, experienceConfig);
    assert.equal(metadata.gameSetupConfig.setting, setupConfig.setting);
  }
  const rejected = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: { name: "Too large", setupConfig: { ...setupConfig, experienceConfig: { data: "x".repeat(262_145) } } },
  });
  assert.ok(rejected.statusCode >= 400, "Opaque experience config must remain bounded");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("Explicit and legacy Experience configs, long settings and size ceiling passed.");
