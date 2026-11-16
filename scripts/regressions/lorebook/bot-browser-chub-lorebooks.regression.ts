import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import { botBrowserRoutes } from "../../../packages/server/src/routes/bot-browser.routes.js";

const captured: URL[] = [];
const app = Fastify();

await app.register(botBrowserRoutes, {
  prefix: "/api/bot-browser",
  fetchJson: async (url) => {
    captured.push(new URL(url));
    return { data: { nodes: [], count: 0 } };
  },
});

try {
  // Search goes to the lorebooks namespace, with the shared sort and tag filters.
  const search = await app.inject({
    method: "GET",
    url: "/api/bot-browser/chub/lorebooks/search?q=fantasy&page=3&sort=newest&tags=Fantasy&excludeTags=NSFW",
  });
  assert.equal(search.statusCode, 200);
  const searchUrl = captured.at(-1);
  assert.ok(searchUrl, "lorebook search should make an outbound request");
  assert.equal(searchUrl.hostname, "api.chub.ai");
  assert.equal(searchUrl.pathname, "/search");
  assert.equal(searchUrl.searchParams.get("namespace"), "lorebooks");
  assert.equal(searchUrl.searchParams.get("search"), "fantasy");
  assert.equal(searchUrl.searchParams.get("page"), "3");
  assert.equal(searchUrl.searchParams.get("sort"), "newest");
  assert.equal(searchUrl.searchParams.get("topics"), "Fantasy");
  assert.equal(searchUrl.searchParams.get("excludetopics"), "NSFW");
  assert.equal(searchUrl.searchParams.get("count"), "true");

  // Detail strips the `lorebooks/` prefix search returns: Chub's detail API 404s with it.
  const detail = await app.inject({
    method: "GET",
    url: "/api/bot-browser/chub/lorebook/lorebooks/someone/world-atlas",
  });
  assert.equal(detail.statusCode, 200);
  const detailUrl = captured.at(-1);
  assert.equal(detailUrl?.pathname, "/api/lorebooks/someone/world-atlas");
  assert.equal(detailUrl?.searchParams.get("full"), "true");

  // A bare `<creator>/<slug>` works too.
  const beforeBare = captured.length;
  const bare = await app.inject({ method: "GET", url: "/api/bot-browser/chub/lorebook/someone/world-atlas" });
  assert.equal(bare.statusCode, 200);
  assert.equal(captured.length, beforeBare + 1);
  assert.equal(captured.at(-1)?.pathname, "/api/lorebooks/someone/world-atlas");

  // Anything that is not exactly `<creator>/<slug>` is refused before any outbound request.
  const before = captured.length;
  for (const bad of ["lorebooks/only-one", "a/b/c", "lorebooks/../x", "someone/.."]) {
    const res = await app.inject({ method: "GET", url: `/api/bot-browser/chub/lorebook/${bad}` });
    assert.equal(res.statusCode, 400, `${bad} should be refused`);
  }
  assert.equal(captured.length, before, "refused paths must not reach Chub");
} finally {
  await app.close();
}

console.log("Bot Browser Chub lorebook route checks passed.");
