import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  // The seam's shape: the CLASSIC wizard now emits the whole GameSetupConfig it always did, plus the two
  // Experience keys appended as a conditional spread, with a FLAT experienceConfig (the package's own
  // literals and the host-collected seed side by side, not nested one level down). This is what every
  // Pixelforge-style game created through the shared wizard looks like, and it has to leave the top-level
  // `gameExperienceId` stamp on the chat — without it `resolveExperienceStateGameType` 409s the package's
  // very first state call and the world never loads.
  const wizardShapedConfig = {
    genre: "Fantasy",
    setting: "A walkable settlement built out of tiles.",
    tone: "Hopeful",
    difficulty: "normal",
    rating: "sfw",
    gmMode: "standalone",
    gmCharacterId: undefined,
    personaId: null,
    partyCharacterIds: [],
    playerGoals: "Build a settlement that survives the winter.",
    combatStyle: "classic",
    gameWorldMapMode: "standard",
    language: "English",
    autoTranslate: false,
    enableAgents: true,
    enableQuickTimeEvents: true,
    enableCustomWidgets: false,
    customHudWidgets: [],
    enableSpriteGeneration: false,
    enableSpotifyDj: false,
    enableLorebookKeeper: false,
    enableGameSoundEffects: true,
    enableGameMusic: true,
    activeLorebookIds: [],
    useCampaignArtStyle: false,
    imageStyleProfileId: null,
    promptPresetId: null,
    gameGmPromptTemplateId: null,
    gameSystemPrompt: null,
    gameSpecialInstructions: null,
    generationParameters: { temperature: 0.7 },
    gameExperienceId: "test-experience",
    experienceConfig: { generate: true, seed: 123456 },
  };
  const wizardResponse = await app.inject({
    method: "POST",
    url: "/api/game/create",
    payload: { name: "Wizard-shaped Experience game", setupConfig: wizardShapedConfig },
  });
  assert.equal(wizardResponse.statusCode, 200, wizardResponse.body);
  const wizardChatId = wizardResponse.json().sessionChat.id;
  const wizardMetadata = JSON.parse(wizardResponse.json().sessionChat.metadata);
  assert.equal(
    wizardMetadata.gameExperienceId,
    "test-experience",
    "A wizard-shaped payload must stamp the chat's top-level gameExperienceId",
  );
  assert.equal(
    wizardMetadata.gameSetupConfig.experienceConfig.seed,
    123456,
    "The host-collected seed must survive as a number inside the stored experienceConfig",
  );
  assert.equal(wizardMetadata.gameSetupConfig.experienceConfig.generate, true);
  // The classic answers are kept beside the Experience keys rather than replaced by them.
  assert.equal(wizardMetadata.gameSetupConfig.setting, wizardShapedConfig.setting);
  assert.deepEqual(wizardMetadata.gameSetupConfig.partyCharacterIds, []);
  assert.equal(wizardMetadata.enableAgents, true);
  // The observable that matters to the package: its first state read is answered, not 409'd.
  const firstStateRead = await app.inject({ method: "GET", url: `/api/game/${wizardChatId}/experience-state` });
  assert.equal(firstStateRead.statusCode, 200, firstStateRead.body);
  assert.equal(firstStateRead.json().exists, false, "A brand-new Experience game starts with no saved state");

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
console.log(
  "Explicit and legacy Experience configs, the wizard-shaped payload, long settings and size ceiling passed.",
);
