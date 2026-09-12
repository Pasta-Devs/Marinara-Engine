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
