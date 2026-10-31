// Key rejection follows HTTP status, never English words in a provider's error.
// Run through scripts/run-regressions.mjs, which supplies isolated storage and an empty .env.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { ConnectionTestResult } from "@marinara-engine/shared";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { ClaudeSubscriptionProvider } from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";

assert.ok(process.env.FILE_STORAGE_DIR, "Run this regression through scripts/run-regressions.mjs");
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/api/connections" });

let status = 200;
const misleadingMessage = "Unauthorized invalid API key; HTTP 401/403";
const provider = createServer((request, response) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(
    JSON.stringify(
      status === 200
        ? request.url === "/v1/systemone"
          ? { answers: { test: { type: "noul", noul: 0.9 } } }
          : { data: [] }
        : { error: misleadingMessage },
    ),
  );
});
const originalChat = ClaudeSubscriptionProvider.prototype.chat;
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const catalog = await storage.create({ name: "Catalog", provider: "custom", baseUrl, apiKey: "key", model: "m" });
  const test = async (id: string): Promise<ConnectionTestResult> => {
    const response = await app.inject({ method: "POST", url: `/api/connections/${id}/test` });
    assert.equal(response.statusCode, 200, response.body);
    return response.json<ConnectionTestResult>();
  };
  const checkFailure = (result: ConnectionTestResult, expected: string | undefined) => {
    assert.equal(result.success, false, JSON.stringify(result));
    assert.equal(result.errorCode, expected, JSON.stringify(result));
    assert.ok(result.message);
    assert.ok(result.latencyMs >= 0);
  };
  for (status of [200, 400, 401, 403, 429, 500]) {
    const result = await test(catalog.id);
    if (status === 200) {
      assert.equal(result.success, true);
      assert.equal(result.errorCode, undefined);
    } else {
      checkFailure(result, status === 401 || status === 403 ? "AUTH_REJECTED" : undefined);
      assert.equal(result.message, `API returned ${status}: ${misleadingMessage}`);
    }
  }

  for (const decisionSource of ["custom", "openai_compatible"] as const) {
    const decision = await storage.create({
      name: decisionSource,
      provider: "decision",
      decisionSource,
      baseUrl,
      apiKey: "key",
      model: "m",
    });
    for (status of [400, 401, 403, 429, 500]) {
      const result = await test(decision.id);
      checkFailure(result, status === 401 || status === 403 ? "AUTH_REJECTED" : `http_${status}`);
      assert.equal(result.message, `http_${status}`);
    }
    if (decisionSource === "custom") {
      status = 200;
      const result = await test(decision.id);
      assert.equal(result.success, true);
      assert.equal(result.errorCode, undefined);
    }
  }

  // Exercise the route's catch through a provider double. No SDK login or network call occurs.
  let sdkStatus: number | string | undefined;
  ClaudeSubscriptionProvider.prototype.chat = async function* () {
    throw Object.assign(new Error(misleadingMessage), { status: sdkStatus });
  };
  const sdk = await storage.create({ name: "SDK", provider: "claude_subscription", apiKey: "key", model: "m" });
  for (sdkStatus of [400, 401, 403, 500, "401", undefined]) {
    const result = await test(sdk.id);
    checkFailure(result, sdkStatus === 401 || sdkStatus === 403 ? "AUTH_REJECTED" : undefined);
    assert.equal(result.message, `Connection failed: ${misleadingMessage}`);
  }
} finally {
  ClaudeSubscriptionProvider.prototype.chat = originalChat;
  await app.close();
  if (provider.listening) await new Promise<void>((resolve) => provider.close(() => resolve()));
}
console.log("connection auth error code regression passed");
