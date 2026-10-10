import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import {
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
} finally {
  await app.close();
}
console.log("Quick answers and bulk update decline hit their own rate limits.");
