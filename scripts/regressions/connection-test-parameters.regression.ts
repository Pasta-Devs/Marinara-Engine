import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
let directory: string | undefined;
let db:
  | Awaited<ReturnType<typeof import("../../packages/server/src/db/file-backed-store.js").createFileNativeDB>>
  | undefined;
const app = Fastify();
const requests: Record<string, unknown>[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "hello" } }] }));
});
try {
  directory = mkdtempSync(join(tmpdir(), "marinara-test-parameters-"));
  process.env.FILE_STORAGE_DIR = directory;
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  db = await createFileNativeDB();
  const storage = createConnectionsStorage(db);
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  for (const defaults of [
    {},
    { temperature: 1, topP: 0.8, maxTokens: 2048, frequencyPenalty: 0.2, stopSequences: ["end"] },
    { temperature: 1, topP: 0.8, enabledParameters: { temperature: false, topP: false } },
    { maxTokens: 2048, enabledParameters: { maxTokens: false } },
  ]) {
    const created = await app.inject({
      method: "POST",
      url: "/api/connections",
      payload: {
        name: "Test parameter fixture",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "",
        model: "fixture-model",
        defaultParameters: defaults,
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    await storage.updateDefaultParameters(id, defaults);
    const tested = await app.inject({ method: "POST", url: `/api/connections/${id}/test-message` });
    assert.equal(tested.json().success, true, tested.body);
    const sent = requests.at(-1)!;
    assert.equal(
      sent.temperature,
      defaults.enabledParameters?.temperature === false ? undefined : (defaults.temperature ?? 0.7),
    );
    assert.equal(sent.top_p, defaults.enabledParameters?.topP === false ? undefined : defaults.topP);
    // The provider removes explicitly disabled fields, including the route's fallback token limit.
    assert.equal(
      sent.max_tokens,
      defaults.enabledParameters?.maxTokens === false ? undefined : (defaults.maxTokens ?? 200),
    );
    assert.equal(sent.frequency_penalty, defaults.frequencyPenalty);
    if (defaults.stopSequences) assert.deepEqual(sent.stop, defaults.stopSequences);
    assert.deepEqual(sent.messages, [{ role: "user", content: "hi" }]);
  }
} finally {
  try {
    try {
      await app.close();
    } finally {
      try {
        await new Promise<void>((resolve) => provider.close(() => resolve()));
      } finally {
        await db?._fileStore.close();
      }
    }
  } finally {
    if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
    else process.env.FILE_STORAGE_DIR = previousDirectory;
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
console.log("Connection test-message parameter regressions passed.");
