import assert from "node:assert/strict";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { rateLimitHook } from "../../packages/server/src/middleware/rate-limit.js";
import { updatesRoutes } from "../../packages/server/src/routes/updates.routes.js";

const app = Fastify();
app.addHook("onRequest", rateLimitHook);
await app.register(updatesRoutes, { prefix: "/api/updates" });
const originalFetch = globalThis.fetch;
let fetches = 0;
globalThis.fetch = async () => {
  fetches += 1;
  throw new Error("The installed channel must not depend on GitHub availability");
};
try {
  const response = await app.inject({ method: "GET", url: "/api/updates/channel" });
  assert.equal(response.statusCode, 200, response.body);
  const metadata = response.json();
  assert.ok(["stable", "staging"].includes(metadata.channel));
  if (metadata.currentBranch === "staging") assert.equal(metadata.channel, "staging");
  if (metadata.currentBranch === "main") assert.equal(metadata.channel, "stable");
  assert.deepEqual(metadata.channels.map((entry: { id: string }) => entry.id).sort(), ["stable", "staging"]);
  assert.equal(fetches, 0);
  for (let request = 1; request < 30; request += 1) {
    assert.equal((await app.inject({ method: "GET", url: "/api/updates/channel" })).statusCode, 200);
  }
  assert.equal((await app.inject({ method: "GET", url: "/api/updates/channel" })).statusCode, 429);
  assert.equal(fetches, 0);
} finally {
  globalThis.fetch = originalFetch;
  await app.close();
}
console.log("Installed update-channel metadata is available without network requests.");
