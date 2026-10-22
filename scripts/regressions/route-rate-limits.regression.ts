import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  EXPERIENCE_FILE_IMPORT_RATE_LIMIT,
  GAME_TILE_PACKS_RATE_LIMIT,
  GAME_WORLDS_RATE_LIMIT,
  PACKAGE_UPDATE_DECLINE_RATE_LIMIT,
  PROFESSOR_MARI_QUICK_RATE_LIMIT,
  rateLimitHook,
} from "../../packages/server/src/middleware/rate-limit.js";

// A route's `config.rateLimit` only documents the limit; the hook enforces its own rule table. Each route
// that declares a limit must also hit that wall, not the 600/min default.
const app = Fastify();
app.addHook("onRequest", rateLimitHook);
app.post("/api/professor-mari/quick/prompt", async () => ({ ok: true }));
app.post("/api/professor-mari/quick/proposals/:id/apply", async () => ({ ok: true }));
app.post("/api/capability-packages/updates/decline", async () => ({ ok: true }));
app.post("/api/capability-packages/experience-file", async () => ({ ok: true }));
app.post("/api/game-tile-packs", async () => ({ ok: true }));
app.post("/api/game-tile-packs/import", async () => ({ ok: true }));
app.post("/api/game-tile-packs/builtin/:family", async () => ({ ok: true }));
app.post("/api/game-worlds", async () => ({ ok: true }));
app.post("/api/game-worlds/import", async () => ({ ok: true }));
app.post("/api/game-worlds/:id/story", async () => ({ ok: true }));

async function hitsWallAt(urls: string[], max: number) {
  for (let request = 0; request < max; request += 1) {
    const url = urls[request % urls.length]!;
    assert.equal((await app.inject({ method: "POST", url })).statusCode, 200, url);
  }
  assert.equal((await app.inject({ method: "POST", url: urls[0]! })).statusCode, 429, urls[0]);
}

try {
  await hitsWallAt(
    ["/api/professor-mari/quick/prompt", "/api/professor-mari/quick/proposals/p1/apply"],
    PROFESSOR_MARI_QUICK_RATE_LIMIT.max,
  );
  await hitsWallAt(["/api/capability-packages/updates/decline"], PACKAGE_UPDATE_DECLINE_RATE_LIMIT.max);
  await hitsWallAt(["/api/capability-packages/experience-file"], EXPERIENCE_FILE_IMPORT_RATE_LIMIT.max);
  await hitsWallAt(
    ["/api/game-tile-packs", "/api/game-tile-packs/import", "/api/game-tile-packs/builtin/fantasy"],
    GAME_TILE_PACKS_RATE_LIMIT.max,
  );
  await hitsWallAt(
    ["/api/game-worlds", "/api/game-worlds/import", "/api/game-worlds/w1/story"],
    GAME_WORLDS_RATE_LIMIT.max,
  );
} finally {
  await app.close();
}
console.log("Quick answers, bulk update decline, tile packs and the world library hit their own rate limits.");
