import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { botBrowserDatacatRoutes } from "../../packages/server/src/routes/bot-browser-datacat.routes.js";
import { botBrowserJannyRoutes } from "../../packages/server/src/routes/bot-browser-janny.routes.js";

// DataCat and JannyAI catalog requests go through the outbound URL guard: an upstream redirect cannot send
// the server into this machine or the local network, and an oversized reply is cut off at the size cap.

const internalHits: string[] = [];
const internal = createServer((request, response) => {
  internalHits.push(request.url ?? "");
  response.writeHead(200, { "content-type": "application/json" }).end('{"success":true,"sessionToken":"internal"}');
});
await new Promise<void>((resolve) => internal.listen(0, "127.0.0.1", resolve));
const internalUrl = `http://127.0.0.1:${(internal.address() as AddressInfo).port}/internal`;

// Catalog hosts are fixtures. A request that does not ask for manual redirects follows them, as fetch does by default.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1") return originalFetch(input, init);
  if (url.pathname === "/api/liberator/identify") {
    return Response.json({ success: true, sessionToken: "fixture-session" });
  }
  if (url.pathname.endsWith("/huge")) return Response.json({ pad: "x".repeat(11 * 1024 * 1024) });
  if (init?.redirect !== "manual") return originalFetch(internalUrl);
  return new Response(null, { status: 307, headers: { location: internalUrl } });
}) as typeof fetch;
const originalLookup = dns.lookup;
(dns as { lookup: unknown }).lookup = async () => [{ address: "93.184.216.34", family: 4 }];

const app = Fastify();
await app.register(botBrowserDatacatRoutes);
await app.register(botBrowserJannyRoutes);

try {
  for (const url of ["/datacat/fresh", "/datacat/character/huge", "/janny/search?q=clockwork"]) {
    const response = await app.inject({ method: "GET", url });
    assert.notEqual(response.statusCode, 200, `${url} must not return a redirected or oversized upstream reply`);
  }

  // The token scrape falls back to the built-in token instead of reading a redirected page.
  const token = await app.inject({ method: "GET", url: "/janny/token?force=1" });
  assert.equal(token.statusCode, 200);
  assert.match(token.json<{ token: string }>().token, /^[a-f0-9]{64}$/);

  assert.deepEqual(internalHits, [], "no catalog redirect reaches a loopback service");
} finally {
  globalThis.fetch = originalFetch;
  (dns as { lookup: unknown }).lookup = originalLookup;
  await app.close();
  await new Promise((resolve) => internal.close(resolve));
}

console.log("Card Browser upstream fetch regression passed");
