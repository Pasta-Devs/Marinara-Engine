import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import { botBrowserRoutes } from "../../../packages/server/src/routes/bot-browser.routes.js";

let capturedUrl: URL | null = null;
const app = Fastify();

await app.register(botBrowserRoutes, {
  prefix: "/api/bot-browser",
  fetchJson: async (url) => {
    capturedUrl = new URL(url);
    return { data: { nodes: [], count: 0 } };
  },
});

try {
  const response = await app.inject({
    method: "GET",
    url: "/api/bot-browser/chub/search?q=clockwork&page=2&nsfw=true",
  });

  assert.equal(response.statusCode, 200);
  assert.ok(capturedUrl, "Chub search route should make an outbound request");
  assert.equal(capturedUrl.hostname, "api.chub.ai");
  assert.equal(capturedUrl.pathname, "/search");
  assert.equal(capturedUrl.searchParams.get("namespace"), "characters");
  assert.equal(capturedUrl.searchParams.get("nsfw"), "true");
  assert.equal(capturedUrl.searchParams.get("nsfl"), "true");
  assert.equal(capturedUrl.searchParams.get("nsfw_only"), "false");
  assert.equal(capturedUrl.searchParams.get("chub"), "true");
  assert.equal(capturedUrl.searchParams.get("count"), "true");
} finally {
  await app.close();
}

console.log("Bot Browser route regression checks passed.");
