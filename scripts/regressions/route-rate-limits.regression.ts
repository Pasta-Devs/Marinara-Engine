import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
  ACCESS_LOGIN_RATE_LIMIT,
  CONNECTION_TEST_RATE_LIMIT,
  EXPERIENCE_FILE_IMPORT_RATE_LIMIT,
  GAME_TILE_PACKS_RATE_LIMIT,
  GAME_WORLDS_RATE_LIMIT,
  LOGIN_PAGE_RATE_LIMIT,
  MARINARA_NOTICES_RATE_LIMIT,
  PACKAGE_UPDATE_DECLINE_RATE_LIMIT,
  PROFESSOR_MARI_QUICK_RATE_LIMIT,
  SPRITE_RENAME_RATE_LIMIT,
  UTILITY_SIDECAR_RATE_LIMIT,
  rateLimitHook,
} from "../../packages/server/src/middleware/rate-limit.js";

// Each route that declares a limit must hit that wall, not the 600/min default. The hook's rule table
// wins where it matches (it shares one bucket across related routes); any other route keeps the
// `config.rateLimit` it declares.
const app = Fastify();
app.addHook("onRequest", rateLimitHook);
app.post("/api/connections/:id/test", async () => ({ ok: true }));
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
app.post("/api/generate", async () => ({ ok: true }));
// The sign-in pages sit outside /api but check passwords and codes, so they are throttled too.
app.post("/login", async () => ({ ok: true }));
app.post("/login/setup", async () => ({ ok: true }));
// No table rule covers these; only their declarations bound them.
app.post("/api/access/pairing-codes", { config: { rateLimit: ACCESS_LOGIN_RATE_LIMIT } }, async () => ({ ok: true }));
// Registered like the real notices route: "/" under a prefix, so Fastify also adds a trailing-slash HEAD route.
await app.register(
  async (scope) => {
    scope.get("/", { config: { rateLimit: MARINARA_NOTICES_RATE_LIMIT } }, async () => ({ ok: true }));
  },
  { prefix: "/api/notices" },
);
app.post("/api/utility-sidecar/start", { config: { rateLimit: UTILITY_SIDECAR_RATE_LIMIT } }, async () => ({
  ok: true,
}));
app.get("/api/sprites/:characterId/:expression", async () => ({ ok: true }));
app.patch("/api/sprites/:characterId/:expression", { config: { rateLimit: SPRITE_RENAME_RATE_LIMIT } }, async () => ({
  ok: true,
}));

type Method = "GET" | "HEAD" | "POST" | "PATCH";

async function hitsWallAt(urls: string[], max: number, method: Method = "POST") {
  for (let request = 0; request < max; request += 1) {
    const url = urls[request % urls.length]!;
    assert.equal((await app.inject({ method, url })).statusCode, 200, url);
  }
  assert.equal((await app.inject({ method, url: urls[0]! })).statusCode, 429, urls[0]);
}

// app.inject() normalizes its URL, so an absolute-form request line needs a real socket.
function rateLimitOverSocket(port: number, method: Method, target: string) {
  return new Promise<string | undefined>((resolveLimit, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, method, path: target }, (res) => {
      res.resume();
      res.on("end", () => resolveLimit(res.headers["ratelimit-limit"] as string | undefined));
    });
    req.on("error", reject);
    req.end();
  });
}

try {
  await hitsWallAt(["/api/connections/a/test", "/api/connections/b/test?debug=true"], CONNECTION_TEST_RATE_LIMIT.max);
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
  await hitsWallAt(["/login", "/login/setup?next=%2F"], LOGIN_PAGE_RATE_LIMIT.max);

  await hitsWallAt(["/api/access/pairing-codes"], ACCESS_LOGIN_RATE_LIMIT.max);
  await hitsWallAt(["/api/notices", "/api/notices/?tab=2"], MARINARA_NOTICES_RATE_LIMIT.max, "GET");
  for (const url of ["/api/notices", "/api/notices/"]) {
    assert.equal((await app.inject({ method: "HEAD", url })).statusCode, 429, `HEAD ${url} shares the GET bucket`);
  }
  await hitsWallAt(["/api/utility-sidecar/start"], UTILITY_SIDECAR_RATE_LIMIT.max);
  await hitsWallAt(["/api/sprites/c1/happy", "/api/sprites/c2/sad"], SPRITE_RENAME_RATE_LIMIT.max, "PATCH");
  const spriteRead = await app.inject({ method: "GET", url: "/api/sprites/c1/happy" });
  assert.equal(spriteRead.statusCode, 200, "the rename limit binds only the route that declares it");
  assert.equal(spriteRead.headers["ratelimit-limit"], "600");

  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  assert.equal(await rateLimitOverSocket(port, "POST", "/api/generate"), "60");
  assert.equal(
    await rateLimitOverSocket(port, "POST", `${origin}/api/generate`),
    "60",
    "an absolute-form target hits the route's own wall",
  );
  assert.equal(
    await rateLimitOverSocket(port, "POST", `${origin}/login`),
    String(LOGIN_PAGE_RATE_LIMIT.max),
    "an absolute-form sign-in page request is throttled",
  );
} finally {
  await app.close();
}
console.log(
  "Quick answers, bulk update decline, tile packs, the world library, the sign-in pages and routes that only declare a limit hit their own rate limits.",
);
