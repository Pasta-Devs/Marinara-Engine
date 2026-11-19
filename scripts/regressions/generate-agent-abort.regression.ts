import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { generateRoutes } from "../../packages/server/src/routes/generate.routes.js";
import type { ActiveAgentRun } from "../../packages/server/src/routes/generate/retry-agents-route.js";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await generateRoutes(app);

const primaryController = new AbortController();
const agentController = new AbortController();
const activeGenerations = (
  app as unknown as {
    activeGenerations: Map<string, ActiveAgentRun>;
  }
).activeGenerations;
activeGenerations.set("attached-agent-abort", {
  abortController: primaryController,
  agentAbortController: agentController,
  backendUrl: null,
  messageId: null,
  swipeIndex: null,
});

try {
  const response = await app.inject({
    method: "POST",
    url: "/abort",
    payload: { chatId: "attached-agent-abort", agentsOnly: true },
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json(), { aborted: true, count: 1 });
  assert.equal(agentController.signal.aborted, true, "Stop Agents must cancel attached agent work");
  assert.equal(primaryController.signal.aborted, false, "Stop Agents must preserve the primary response");

  // A local backend's own abort endpoint stops everything it runs, so only a full Stop may call it: Stop Agents
  // aborting an old agent tail must not kill a newer reply on the same backend.
  let backendAborts = 0;
  const backend = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/api/extra/abort") backendAborts += 1;
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = backend.address() as AddressInfo;
    for (const agentsOnly of [true, false]) {
      activeGenerations.set("backend-abort", {
        abortController: new AbortController(),
        agentAbortController: new AbortController(),
        backendUrl: `http://127.0.0.1:${port}/v1`,
        messageId: null,
        swipeIndex: null,
      });
      const stop = await app.inject({
        method: "POST",
        url: "/abort",
        payload: { chatId: "backend-abort", agentsOnly },
      });
      assert.equal(stop.statusCode, 200, stop.body);
      assert.equal(
        backendAborts,
        agentsOnly ? 0 : 1,
        agentsOnly ? "Stop Agents must not call the backend's abort" : "a full Stop calls the backend's abort once",
      );
    }
  } finally {
    backend.close();
  }

  console.info("Attached agent abort regression passed.");
} finally {
  activeGenerations.clear();
  await app.close();
  await closeDB();
}
